'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ── Tipos ──────────────────────────────────────────────────────
interface Category { id: number; name: string }

// ── Constantes ─────────────────────────────────────────────────
const ACCESS_CODE = process.env.NEXT_PUBLIC_ACCESS_CODE ?? '1111'

// ══════════════════════════════════════════════════════════════
export default function PublicarPage() {
  const [authed, setAuthed] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState(false)

  if (!authed) return (
    <LoginScreen
      code={code}
      setCode={setCode}
      error={codeError}
      onSubmit={() => {
        if (code === ACCESS_CODE) setAuthed(true)
        else setCodeError(true)
      }}
    />
  )

  return <FormularioPublicar />
}

// ══════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════
function LoginScreen({ code, setCode, error, onSubmit }: {
  code: string
  setCode: (v: string) => void
  error: boolean
  onSubmit: () => void
}) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <img src="https://noticias33.com/wp-content/uploads/2026/04/cropped-Captura-de-pantalla-2026-04-21-164553-69x47.png"
          alt="N33" className="h-10 mx-auto mb-6" />
        <h1 className="text-white text-xl font-semibold text-center mb-6">Portal de Redacción</h1>
        <input
          type="password"
          placeholder="Clave de acceso"
          value={code}
          onChange={e => { setCode(e.target.value); }}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          className={`w-full bg-gray-800 text-white rounded-xl px-4 py-3 outline-none border-2 
            ${error ? 'border-red-500' : 'border-transparent'} focus:border-blue-500 transition`}
        />
        {error && <p className="text-red-400 text-sm mt-2 text-center">Clave incorrecta</p>}
        <button
          onClick={onSubmit}
          className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition"
        >
          Ingresar
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// FORMULARIO PRINCIPAL
// ══════════════════════════════════════════════════════════════
function FormularioPublicar() {
  const [categories, setCategories] = useState<Category[]>([])
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [publishedUrl, setPublishedUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{title?: boolean; content?: boolean; category?: boolean}>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)

  // Cargar categorías
  useEffect(() => {
    fetch('/api/categorias').then(r => r.json()).then(setCategories)
  }, [])

  // ── Imagen ────────────────────────────────────────────────
  const handleImage = (file: File) => {
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleImage(file)
  }

  // ── Tags ──────────────────────────────────────────────────
  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag))

  // ── Editor flotante ───────────────────────────────────────
  const [toolbar, setToolbar] = useState({ visible: false, top: 0, left: 0 })

  const handleSelection = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !editorRef.current?.contains(sel.anchorNode)) {
      setToolbar(t => ({ ...t, visible: false }))
      return
    }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const editorRect = editorRef.current.getBoundingClientRect()
    setToolbar({
      visible: true,
      top: rect.top - editorRect.top - 48,
      left: rect.left - editorRect.left + rect.width / 2,
    })
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelection)
    return () => document.removeEventListener('selectionchange', handleSelection)
  }, [handleSelection])

  const format = (cmd: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
    setContent(editorRef.current?.innerHTML ?? '')
  }

  const formatBlockquote = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const selectedText = range.toString()
    const bq = document.createElement('blockquote')
    bq.style.cssText = 'border-left:4px solid #3b82f6;padding-left:1rem;margin:1rem 0;color:#94a3b8;font-style:italic'
    bq.textContent = selectedText
    range.deleteContents()
    range.insertNode(bq)
    setContent(editorRef.current?.innerHTML ?? '')
    setToolbar(t => ({ ...t, visible: false }))
  }

  // ── Publicar ──────────────────────────────────────────────
  const handlePublish = async () => {
    const errors: {title?: boolean; content?: boolean; category?: boolean} = {}
    if (!title.trim()) errors.title = true
    if (!content.trim() || content === '<br>') errors.content = true
    if (!categoryId) errors.category = true

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setErrorMsg('Completá los campos marcados en rojo.')

      // Scroll al primer campo con error
      if (errors.title) titleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else if (errors.category) categoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else if (errors.content) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

      return
    }

    setFieldErrors({})
    setErrorMsg('')
    setStatus('loading')

    try {
      // 1. Subir imagen
      let featuredMediaId = 0
      if (image) {
        const fd = new FormData()
        fd.append('file', image)
        const mediaRes = await fetch('/api/media', { method: 'POST', body: fd })
        const mediaData = await mediaRes.json()
        if (!mediaRes.ok) throw new Error(mediaData.error?.message ?? 'Error al subir imagen')
        featuredMediaId = mediaData.id
      }

      // 2. Crear post
      // Resolver IDs de tags
      const tagIds = await resolveTagIds(tags)

      const postRes = await fetch('/api/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, excerpt, content, categoryId, tags: tagIds, featuredMediaId }),
      })
      const postData = await postRes.json()
      if (!postRes.ok) throw new Error(postData.error?.message ?? 'Error al publicar')

      setPublishedUrl(postData.url)
      setStatus('success')
    } catch (err: any) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  // ── Resolver tags (crear si no existen) ───────────────────
  const resolveTagIds = async (tagNames: string[]): Promise<number[]> => {
    const ids: number[] = []
    for (const name of tagNames) {
      const search = await fetch(`/api/tags?name=${encodeURIComponent(name)}`)
      const data = await search.json()
      if (data.id) ids.push(data.id)
    }
    return ids
  }

  // ── Pantalla de éxito ─────────────────────────────────────
  if (status === 'success') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-white text-2xl font-bold mb-2">¡Nota publicada!</h2>
        <p className="text-gray-400 mb-6">La nota ya está visible en el sitio.</p>
        <a href={publishedUrl} target="_blank"
          className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition mb-3">
          Ver nota publicada
        </a>
        <button onClick={() => { setStatus('idle'); setTitle(''); setExcerpt(''); setContent(''); setTags([]); setImage(null); setImagePreview(null); setCategoryId(null); setFieldErrors({}) }}
          className="block w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition">
          Publicar otra nota
        </button>
      </div>
    </div>
  )

  // ── Formulario ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <img src="https://noticias33.com/wp-content/uploads/2026/04/cropped-Captura-de-pantalla-2026-04-21-164553-69x47.png"
            alt="N33" className="h-8" />
          <h1 className="text-xl font-semibold text-gray-200">Nueva nota</h1>
        </div>
        <p className="text-sm text-gray-500 mb-6">Los campos marcados con <span className="text-red-400">*</span> son obligatorios</p>

        {/* Imagen destacada */}
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          className="relative w-full h-48 rounded-2xl border-2 border-dashed border-gray-700 hover:border-blue-500 
            flex items-center justify-center cursor-pointer mb-6 overflow-hidden transition group"
        >
          {imagePreview
            ? <img src={imagePreview} className="w-full h-full object-cover" />
            : <div className="text-center text-gray-500 group-hover:text-blue-400 transition">
                <div className="text-3xl mb-1">📷</div>
                <p className="text-sm">Arrastrá o hacé click para subir la imagen destacada</p>
              </div>
          }
          {imagePreview && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <span className="text-white text-sm font-medium">Cambiar imagen</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleImage(e.target.files[0])} />
        </div>

        {/* Título */}
        <input
          ref={titleRef}
          type="text" placeholder="Título de la nota *"
          value={title} onChange={e => { setTitle(e.target.value); setFieldErrors(f => ({...f, title: false})) }}
          className={`w-full bg-gray-900 rounded-xl px-4 py-3 text-lg font-semibold placeholder-gray-600 
            outline-none border-2 transition mb-3 focus:border-blue-500
            ${fieldErrors.title ? 'border-red-500' : 'border-transparent'}`}
        />

        {/* Subtítulo / Excerpt */}
        <input
          type="text" placeholder="Subtítulo (resumen breve)"
          value={excerpt} onChange={e => setExcerpt(e.target.value)}
          className="w-full bg-gray-900 rounded-xl px-4 py-3 placeholder-gray-600 
            outline-none border-2 border-transparent focus:border-blue-500 transition mb-3"
        />

        {/* Categoría */}
        <select
          ref={categoryRef}
          value={categoryId ?? ''}
          onChange={e => { setCategoryId(Number(e.target.value)); setFieldErrors(f => ({...f, category: false})) }}
          className={`w-full bg-gray-900 rounded-xl px-4 py-3 text-gray-300 outline-none 
            border-2 transition mb-3 appearance-none focus:border-blue-500
            ${fieldErrors.category ? 'border-red-500' : 'border-transparent'}`}
        >
          <option value="" disabled>Seleccionar categoría *</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Tags */}
        <div className="bg-gray-900 rounded-xl px-4 py-3 mb-6 border-2 border-transparent focus-within:border-blue-500 transition">
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map(tag => (
              <span key={tag} className="bg-teal-900/60 text-teal-200 text-sm px-3 py-1 rounded-full flex items-center gap-1">
                {tag}
                <button onClick={() => removeTag(tag)} className="text-teal-300 hover:text-white transition ml-1">×</button>
              </span>
            ))}
          </div>
          <input
            type="text" placeholder="Agregar tag y presionar Enter"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
            className="w-full bg-transparent text-white placeholder-gray-600 outline-none text-sm"
          />
        </div>

        {/* Editor */}
        <div className="relative mb-6">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Cuerpo de la nota *</p>
          <p className="text-xs text-gray-600 mb-3">Seleccioná texto para aplicar formato</p>

          {/* Barra flotante */}
          {toolbar.visible && (
            <div
              ref={toolbarRef}
              style={{ top: toolbar.top, left: toolbar.left, transform: 'translateX(-50%)' }}
              className="absolute z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl 
                flex items-center gap-1 px-2 py-1.5"
            >
              <ToolbarBtn onClick={() => format('bold')} title="Negrita">
                <strong>N</strong>
              </ToolbarBtn>
              <ToolbarBtn onClick={() => format('italic')} title="Itálica">
                <em>I</em>
              </ToolbarBtn>
              <ToolbarBtn onClick={formatBlockquote} title="Cita">
                ❝
              </ToolbarBtn>
              <div className="w-px h-4 bg-gray-600 mx-1" />
              <ToolbarBtn onClick={() => {
                const url = prompt('URL del enlace:')
                if (url) format('createLink', url)
              }} title="Enlace">
                🔗
              </ToolbarBtn>
            </div>
          )}

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => { setContent(editorRef.current?.innerHTML ?? ''); setFieldErrors(f => ({...f, content: false})) }}
            data-placeholder="Escribí el cuerpo de la nota acá..."
            className={`min-h-64 bg-gray-900 rounded-xl px-4 py-3 outline-none border-2 
              transition text-gray-200 leading-relaxed focus:border-blue-500
              empty:before:content-[attr(data-placeholder)] empty:before:text-gray-600
              ${fieldErrors.content ? 'border-red-500' : 'border-transparent'}`}
          />
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">
            {errorMsg}
          </div>
        )}

        {/* Botón publicar */}
        <button
          onClick={handlePublish}
          disabled={status === 'loading'}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed
            text-white font-bold py-4 rounded-xl transition text-lg"
        >
          {status === 'loading' ? '⏳ Publicando...' : 'Publicar nota'}
        </button>

      </div>
    </div>
  )
}

// ── Botón de toolbar ──────────────────────────────────────────
function ToolbarBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className="w-8 h-8 rounded-lg hover:bg-gray-700 text-white flex items-center justify-center text-sm transition"
    >
      {children}
    </button>
  )
} 