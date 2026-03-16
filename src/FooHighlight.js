import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const pluginKey = new PluginKey('errorHighlight')

function buildDecorations(doc, annotations) {
  const decorations = []
  annotations.forEach(({ text, message }) => {
    doc.descendants((node, pos) => {
      if (!node.isText) return
      let index = 0
      while ((index = node.text.indexOf(text, index)) !== -1) {
        decorations.push(
          Decoration.inline(pos + index, pos + index + text.length, {
            class: 'foo-highlight',
            'data-message': message,
          }, { text })
        )
        index += text.length
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
            const valid = mapped.find().filter(d => tr.doc.textBetween(d.from, d.to) === d.spec.text)
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
