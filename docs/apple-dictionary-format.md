# Apple Dictionary Format: Portuguese–English

Notes on the binary format of macOS Dictionary bundles, reverse-engineered from
`Portuguese - English.dictionary`, and the lookup implementation built on top of it.

---

## Bundle location

macOS dictionary bundles live under:

```
/System/Library/AssetsV2/com_apple_MobileAsset_DictionaryServices_dictionaryOSX/
  <hash>.asset/AssetData/
    Portuguese - English.dictionary/Contents/Resources/
```

There are multiple hash directories; the right one is whichever contains a
`Body.data` file. The implementation searches all subdirectories at startup.

---

## Files in Resources/

| File | Size | Purpose |
|---|---|---|
| `Body.data` | 13 MB | All dictionary entry content (compressed XML) |
| `KeyText.data` | 3 MB | Key text records (compressed, proprietary format) |
| `KeyText.index` | 5 MB | B-tree index over KeyText.data |
| `EntryID.data` | 68 KB | Entry ID mapping (raw binary) |
| `EntryID.index` | 34 KB | Index over EntryID.data |
| `DefaultStyle.css` | — | Stylesheet used by Dictionary.app |
| `*.lproj/` | — | Localised UI strings |

The `KeyText.index` and `EntryID.index` files use Apple's proprietary B-tree
format and were not fully reverse-engineered. The implementation reads
`Body.data` directly instead.

---

## Body.data format

### High-level structure

`Body.data` is a sequence of **399 independently-decompressible zlib blocks**,
each containing a batch of dictionary entries as UTF-8 XML. The blocks are
arranged in two sections, sorted alphabetically within each section:

- **Blocks 1–258**: English headwords → Portuguese translations
- **Blocks 259–399**: Portuguese headwords → English translations

### Block chaining

Each block is preceded by a **12-byte header**:

```
[4 bytes] [4 bytes] [4 bytes compressed size] [zlib stream...]
```

The exact semantics of the first two 4-byte fields were not fully decoded, but
the third is the decompressed size of this block. After the zlib stream
completes, the next 12-byte header immediately follows.

### Finding blocks without parsing headers

`Body.data` contains exactly **629 occurrences** of the zlib magic bytes
`0x78 0xDA` (deflate, maximum compression). Of these, **399 are real block
starts**; the other 230 are false positives that appear within compressed data
and fail to decompress. The implementation scans all 629 positions, attempts
`inflateSync` on each, and keeps only those that produce valid XML containing
`d:entry` elements. This scan takes ~410ms in Node.js and runs once at startup.

### zlib streams

Each block is a complete, standalone zlib stream. Node.js `inflateSync` handles
trailing data correctly — it stops at the stream boundary and ignores the rest
of the file. This means `inflateSync(bodyData.subarray(blockOffset))` works
without knowing the compressed block length in advance.

---

## Entry XML format

Each decompressed block contains one or more `<d:entry>` elements in Apple's
Dictionary XML dialect:

```xml
<d:entry xmlns:d="http://www.apple.com/DTDs/DictionaryService-1.0.rng"
         id="p_b-pt-en0005955"
         d:title="casa"
         class="entry">

  <!-- Headword -->
  <span class="hw">casa </span>

  <!-- Part of speech -->
  <span class="ps x_xdh">feminine noun <d:pos></d:pos></span>

  <!-- POS section (gramb) — entries with multiple POS have one per word class -->
  <span class="gramb x_xd0 hasSn">

    <!-- Part of speech label -->
    <span class="ps">noun <d:pos></d:pos></span>

    <!-- Sense group (one per numbered sense) -->
    <span class="semb x_xd1 hasSn">
      <!-- NOTE: "semb" also appears in "gp tg_semb" label elements — only select semb+x_xd1 -->
      <span class="gp x_xdh sn ty_label tg_semb">1 </span>

      <!-- PT entries use "trgg x_xd2" (double-g); EN entries use "trg x_xd2" -->
      <!-- Select by x_xd2 and strip exg children to avoid example translations -->
      <span class="trgg x_xd2">
        <span class="ind">(edifício para habitação) </span>
        <span class="trans" d:def="1">
          house
          <!-- inline annotations to strip before reading text: -->
          <var title="feminino">{f}</var>       <!-- grammatical gender -->
          <span class="reg">Portugal</span>     <!-- regional variant -->
          <span class="gp tg_tr">, </span>      <!-- punctuation -->
        </span>
      </span>

      <!-- Example sentence -->
      <span class="exg x_xd2">
        <span class="x_xdh">
          <span class="sn">▸ </span>
          <span class="ex">alugar/comprar uma casa </span>
        </span>
        <span class="trg x_xd3">   <!-- x_xd3 = example translation; never a main sense trans -->
          <span class="trans">to rent/buy a house</span>
        </span>
      </span>
    </span>

    <!-- More semb elements for senses 2, 3 … -->
  </span>

  <!-- Second gramb for a different POS (e.g. "transitive verb") -->
  <span class="gramb x_xd0 hasSn">
    <span class="ps">transitive verb <d:pos></d:pos></span>
    <span class="semb x_xd1 hasSn">
      <span class="gp x_xdh sn ty_label tg_semb">1 </span>
      <span class="trg x_xd2">   <!-- verb senses use single-g "trg" -->
        <span class="ind">(give lodging to) </span>
        <span class="trans" d:def="1">alojar</span>
      </span>
    </span>
  </span>
</d:entry>
```

### Key CSS classes

| Class | Content | Notes |
|---|---|---|
| `hw` | Headword | |
| `gramb x_xd0` | POS section container | One per word class (noun, verb…). Entries with a single POS may omit this wrapper. |
| `ps` | Part of speech label | Contains an empty `<d:pos>` child — remove before reading text |
| `semb x_xd1` | Sense group | **Must select `x_xd1` too** — `tg_semb` label elements also contain the string "semb" in their class and will be matched by `[class~="semb"]` alone |
| `gp … tg_semb` | Sense number label | Has "semb" in class; not a real sense container |
| `trgg x_xd2` | Translation group — **noun senses** | Double-g `trgg`; used by PT→EN entries and EN→PT noun entries |
| `trg x_xd2` | Translation group — **verb/other senses** | Single-g `trg`; used by verb and some other senses |
| `trans` | Translation text | May contain inline `<var>` (gender), `<span class="reg">` (region), and `<span class="gp">` (punctuation) — **strip these before reading** |
| `ind` | Context/indicator | Appears inside parentheses in the rendered output |
| `exg x_xd2` | Example pair container | Also has `x_xd2` — exclude when searching for main-sense `.trans` |
| `ex` | Source-language example | |
| `trg x_xd3` | Example translation group | `x_xd3` depth distinguishes it from main-sense `x_xd2` |
| `var` | Gender annotation | e.g. `{m}`, `{f}` — inline inside `.trans`, strip when extracting translation |
| `reg` | Regional variant label | e.g. "Brazil", "Portugal" — inline inside `.trans`, strip when extracting translation |
| `gp` | Grammar/punctuation helper | Various uses; strip from `.trans` and `.ps` extractions |

### Entry ID prefixes

- `e_DWS-XXXXXX` — English headwords (Oxford/Wordsworth source)
- `e_b-en-pt-XXXXXXX` — English headwords (bilingual source)
- `p_b-pt-en-XXXXXXX` — Portuguese headwords

The implementation uses `pt-en` in the ID to distinguish PT blocks from EN blocks.

---

## Lookup implementation

### Startup index build (`initAppleDict`)

On first call, the implementation:

1. Reads `Body.data` into memory (~13 MB, cached for the process lifetime)
2. Scans all bytes for `0x78 0xDA`
3. Attempts `inflateSync` on each candidate position
4. Keeps positions where the result contains `d:entry` XML
5. Extracts the first and last `d:title` from each valid block
6. Splits blocks into `_enBlocks` and `_ptBlocks` arrays based on entry ID prefix
7. Both arrays are already sorted alphabetically (by the file structure)

Total time: ~410ms. Runs once per server process.

### Word lookup (`lookup(word, dir)`)

1. Selects `_enBlocks` (for `enToPt`) or `_ptBlocks` (for `ptToEn`)
2. Binary-searches by `block.first` to find the block whose range contains the word
3. Also checks the immediately following block (boundary safety)
4. For each candidate block: `inflateSync`, then regex-searches for
   `d:title="<word>"` to extract the full `<d:entry>` element
5. Parses the entry XML with cheerio to extract POS, senses, contexts,
   translations, and examples
6. Returns a structured object: `{ word, pos, senses: [{ num, context, trans, examples }] }`

### What was NOT reverse-engineered

- **`KeyText.index`**: Apple proprietary B-tree. The file is 5 MB uncompressed,
  with a multi-level page structure. Individual pages contain UTF-16LE key
  strings and 4-byte offsets, but the full format (node type flags, page
  linking, overflow handling) was not decoded.
- **`KeyText.data`**: Contains compressed key-text records with body offsets, but
  the exact field layout (particularly the relationship between the offset fields
  and Body.data byte positions) was not confirmed.
- **`EntryID.*`**: Raw binary, no obvious structure beyond a sparse array of IDs.
- **The 12-byte inter-block header**: Third field is decompressed size; first two
  fields are unresolved (possibly checksum + padded compressed size).

If the index files were fully understood, it would be possible to look up a word
in O(log n) without scanning all blocks at startup. The current implementation
achieves O(log n) per lookup after the one-time startup scan.

---

## Coverage

- ~72,875 total entries
- ~258 EN→PT blocks (English headwords with Portuguese translations)
- ~141 PT→EN blocks (Portuguese headwords with English translations)
- Alphabetical range: **a** → **zurzir**
