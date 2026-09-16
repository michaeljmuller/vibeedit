import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const pluginKey = new PluginKey('errorHighlight')

// Normalize non-breaking spaces so annotation text from the LLM (which uses
// regular spaces) can match document text that ProseMirror may have stored
// with non-breaking spaces (U+00A0) at mark boundaries.
function norm(s) { return s.replace(/ /g, ' ') }

function buildDecorations(doc, annotations) {
  const decorations = []
  annotations.forEach(({ text, message }) => {
    const needle = norm(text)
    doc.descendants((node, nodePos) => {
      if (!node.isBlock) return
      // Map each character in this block's text to its absolute doc position.
      // This lets us find matches that span multiple text nodes (e.g. across
      // bold/italic marks) and still get exact from/to positions.
      const charToDocPos = []
      node.descendants((child, childPos) => {
        if (!child.isText) return
        for (let i = 0; i < child.text.length; i++) {
          charToDocPos.push(nodePos + 1 + childPos + i)
        }
      })
      const rawText = node.textContent
      const blockText = norm(rawText)
      let from = 0
      let idx
      while ((idx = blockText.indexOf(needle, from)) !== -1) {
        const docFrom = charToDocPos[idx]
        const docTo = charToDocPos[idx + needle.length - 1] + 1
        if (docFrom !== undefined && docTo !== undefined) {
          // Store the actual document text (pre-normalization) in spec so
          // the stale-decoration validator can compare with textBetween directly.
          const specText = rawText.slice(idx, idx + needle.length)
          decorations.push(
            Decoration.inline(docFrom, docTo, {
              class: 'foo-highlight',
              'data-message': message,
            }, { text: specText })
          )
        }
        from = idx + needle.length
      }
    })
  })
  return DecorationSet.create(doc, decorations)
}

export const FooHighlight = Extension.create({
  name: 'errorHighlight',

  addCommands() {
    return {
      setAnnotations: (annotations) => ({ tr, dispatch }) => {
        if (dispatch) dispatch(tr.setMeta(pluginKey, annotations))
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, prev) {
            const annotations = tr.getMeta(pluginKey)
            if (annotations !== undefined) {
              return annotations.length
                ? buildDecorations(tr.doc, annotations)
                : DecorationSet.empty
            }
            if (!tr.docChanged) return prev
            const mapped = prev.map(tr.mapping, tr.doc)
            const valid = mapped.find().filter(d => tr.doc.textBetween(d.from, d.to, '') === d.spec.text)
            return DecorationSet.create(tr.doc, valid)
          },
        },
        props: {
          decorations(state) {
            return pluginKey.getState(state)
          },
        },
      }),
    ]
  },
})
