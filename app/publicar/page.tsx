'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ── Tipos ──────────────────────────────────────────────────────
interface Category { id: number; name: string }
interface PostItem { id: number; title: string; date: string; link: string; thumbnail: string | null }

// ── Constantes ─────────────────────────────────────────────────
const ACCESS_CODE = process.env.NEXT_PUBLIC_ACCESS_CODE ?? '1111'

// ══════════════════════════════════════════════════════════════
// Componente raíz de la página /publicar. Muestra, una vez logueado,
// un dashboard de 2 columnas: a la izquierda el formulario para crear
// o editar una nota, a la derecha el listado de notas ya publicadas
// (con miniatura) para elegir cuál editar. editingId guarda qué nota
// se está editando (null = nota nueva) y es compartido por ambas
// columnas: la izquierda lo usa para precargar el formulario, la
// derecha para resaltar la fila correspondiente en la lista.
// ══════════════════════════════════════════════════════════════
export default function PublicarPage() {
  const [authed, setAuthed] = useState(false) // true tras validar la clave de acceso
  const [code, setCode] = useState('') // valor tipeado en el input de clave
  const [codeError, setCodeError] = useState(false) // muestra el mensaje de "clave incorrecta"
  const [editingId, setEditingId] = useState<number | null>(null) // id del post en edición, o null si es una nota nueva
  // Se incrementa cada vez que se publica/edita una nota, para que
  // ListaNotas vuelva a pedir el listado sin depender de una navegación.
  const [refreshKey, setRefreshKey] = useState(0)

  // Permite abrir una nota en edición desde un enlace (ej. /publicar?editar=123)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('editar')
    if (id && !isNaN(Number(id))) setEditingId(Number(id))
  }, [])

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

  // Cierra sesión y resetea el estado de navegación (no hay backend de sesión, es todo local)
  const logout = () => { setAuthed(false); setCode(''); setEditingId(null) }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header compartido por las 2 columnas */}
        <div className="flex items-center gap-3 mb-6">
          <img src="https://noticias33.com/wp-content/uploads/2026/04/cropped-Captura-de-pantalla-2026-04-21-164553-69x47.png"
            alt="N33" className="h-8" />
          <h1 className="text-xl font-semibold text-gray-200">Portal de Redacción</h1>
          <a href="/admin"
            className="ml-auto text-gray-500 hover:text-white text-sm px-3 py-2 rounded-xl hover:bg-gray-900 transition">
            Panel de administración
          </a>
          <button
            onClick={logout}
            className="text-gray-500 hover:text-white text-sm px-3 py-2 rounded-xl hover:bg-gray-900 transition"
          >
            Salir
          </button>
        </div>

        {/* Grid de 2 columnas: formulario a la izquierda, listado a la derecha
            (se apilan en una sola columna en pantallas chicas) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* key={editingId} fuerza a React a desmontar/remontar el formulario
              al cambiar entre "nota nueva" y "editar nota X" (o entre dos
              notas distintas), así se resetea todo el estado interno del
              formulario en vez de tener que limpiarlo campo por campo. */}
          <FormularioPublicar
            key={editingId ?? 'nueva'}
            postId={editingId}
            onSaved={() => setRefreshKey(k => k + 1)}
            onExitEdit={() => setEditingId(null)}
          />
          <ListaNotas
            activeEditingId={editingId}
            refreshToken={refreshKey}
            onEditar={id => setEditingId(id)}
          />
        </div>
      </div>
    </div>
  )
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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Resplandores decorativos de fondo */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative bg-gray-900/80 backdrop-blur border border-gray-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-5 bg-gray-800 border border-gray-700 rounded-2xl flex items-center justify-center">
          <img src="https://noticias33.com/wp-content/uploads/2026/04/cropped-Captura-de-pantalla-2026-04-21-164553-69x47.png"
            alt="N33" className="h-8" />
        </div>
        <h1 className="text-white text-2xl font-bold text-center">Portal de Redacción</h1>
        <p className="text-gray-500 text-sm text-center mt-1 mb-8">Ingresá tu clave para publicar y gestionar notas</p>

        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Clave de acceso
        </label>
        <input
          type="password"
          placeholder="••••••••"
          value={code}
          onChange={e => { setCode(e.target.value); }}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          className={`w-full bg-gray-800/80 text-white rounded-xl px-4 py-3 outline-none border-2 tracking-widest placeholder-gray-600
            ${error ? 'border-red-500' : 'border-gray-700/60'} focus:border-blue-500 transition`}
        />
        {error && <p className="text-red-400 text-sm mt-2">Clave incorrecta, intentá de nuevo</p>}
        <button
          onClick={onSubmit}
          className="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 
            text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-blue-900/40"
        >
          Ingresar
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-600 text-xs">o</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>
        <a href="/admin"
          className="block text-center text-gray-400 hover:text-white text-sm transition">
          Ir al Panel de Administración →
        </a>
        <a href="https://noticias33.com/" target="_blank" rel="noopener noreferrer"
          className="block text-center text-teal-400/80 hover:text-teal-300 text-sm mt-3 transition">
          Visitar Noticias33.com ↗
        </a>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// FORMULARIO PRINCIPAL
// Sirve tanto para crear una nota nueva como para editar una existente:
// el modo se determina únicamente por si postId viene o no (null = crear).
// Maneja: carga de categorías, precarga de datos en modo edición, el
// editor de texto enriquecido (contentEditable + barra flotante), tags,
// imagen destacada, validación por campo y el envío final a WordPress.
// ══════════════════════════════════════════════════════════════
function FormularioPublicar({ postId, onSaved, onExitEdit }: {
  postId: number | null
  onSaved: () => void // se llama justo al publicar/editar con éxito, para refrescar el listado de la derecha
  onExitEdit: () => void // vuelve al modo "nota nueva" (botón Cancelar, o al terminar de editar)
}) {
  const [categories, setCategories] = useState<Category[]>([]) // opciones del <select> de categoría, traídas de /api/categorias
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('') // subtítulo/resumen, opcional (no se valida)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [tags, setTags] = useState<string[]>([]) // nombres de tags en texto; se resuelven a IDs de WP recién al publicar
  const [tagInput, setTagInput] = useState('') // valor del input de "agregar tag", separado de la lista ya confirmada
  const [image, setImage] = useState<File | null>(null) // archivo nuevo a subir; si es null se conserva la imagen ya existente (modo edición)
  const [imagePreview, setImagePreview] = useState<string | null>(null) // URL para mostrar la miniatura (blob local o URL remota de WP)
  const [content, setContent] = useState('') // HTML del cuerpo, sincronizado desde el contentEditable
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [publishedUrl, setPublishedUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  // Marca qué campos obligatorios fallaron la validación, para pintarlos en rojo
  // y hacer scroll hasta el primero (ver handlePublish)
  const [fieldErrors, setFieldErrors] = useState<{title?: boolean; content?: boolean; category?: boolean}>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null) // nodo contentEditable real del cuerpo de la nota
  const toolbarRef = useRef<HTMLDivElement>(null) // barra flotante de formato que aparece al seleccionar texto
  const titleRef = useRef<HTMLInputElement>(null) // usado solo para el scroll-to-error del título
  const categoryRef = useRef<HTMLSelectElement>(null) // usado solo para el scroll-to-error de categoría

  // ID de la imagen destacada ya existente en WordPress (modo edición)
  const [existingMediaId, setExistingMediaId] = useState(0)
  // true solo cuando hay postId, mientras se trae la nota desde /api/posts/[id];
  // se usa para mostrar "Cargando nota..." y deshabilitar el botón de publicar
  const [loadingPost, setLoadingPost] = useState(!!postId)

  // Cargar categorías disponibles desde WordPress (vía proxy /api/categorias)
  // para poblar el <select>. Si falla, deja la lista vacía en vez de romper el form.
  useEffect(() => {
    fetch('/api/categorias')
      .then(r => r.json())
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]))
  }, [])

  // Modo edición: cargar la nota existente y precargar el formulario
  useEffect(() => {
    if (!postId) return
    fetch(`/api/posts/${postId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error?.message ?? 'Error al cargar la nota')
        setTitle(data.title ?? '')
        setExcerpt(data.excerpt ?? '')
        setCategoryId(data.categoryId ?? null)
        setTags(data.tags ?? [])
        setExistingMediaId(data.featuredMediaId ?? 0)
        if (data.featuredMediaUrl) setImagePreview(data.featuredMediaUrl)
        setContent(data.content ?? '')
        // El editor es contentEditable (no controlado por React), así que
        // además de guardar el HTML en el estado hay que inyectarlo a mano en el DOM
        if (editorRef.current) editorRef.current.innerHTML = data.content ?? ''
      })
      .catch((err: any) => setErrorMsg(err.message ?? 'Error al cargar la nota'))
      .finally(() => setLoadingPost(false))
  }, [postId])

  // ── Imagen ────────────────────────────────────────────────
  // Guarda el File elegido (se sube a WordPress recién al publicar, ver
  // handlePublish) y genera una URL local de blob para previsualizarlo
  // sin necesidad de subirlo antes de tiempo.
  const handleImage = (file: File) => {
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  // Soporte de drag&drop sobre el recuadro de imagen destacada
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleImage(file)
  }

  // ── Tags ──────────────────────────────────────────────────
  // Normaliza a minúsculas y evita duplicados antes de agregar el tag a la
  // lista local; los nombres se resuelven a IDs de WordPress más adelante
  // (ver resolveTagIds), recién al publicar.
  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag))

  // ── Editor flotante ───────────────────────────────────────
  // Estilo tipo Medium/Notion: en vez de una barra de herramientas fija,
  // aparece una mini barra flotante justo arriba del texto seleccionado.
  const [toolbar, setToolbar] = useState({ visible: false, top: 0, left: 0 })

  // Se dispara en cada cambio de selección del documento (no solo dentro
  // del editor), por eso primero valida que la selección esté colapsada
  // (nada seleccionado) o fuera del editor para ocultar la barra.
  // Si hay selección válida, posiciona la barra flotante centrada arriba
  // del texto seleccionado, en coordenadas relativas al editor.
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

  // Escucha selectionchange a nivel documento (no hay evento equivalente
  // acotado solo al editor) para saber cuándo mostrar/ocultar la barra
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelection)
    return () => document.removeEventListener('selectionchange', handleSelection)
  }, [handleSelection])

  // Aplica un comando de formato nativo del navegador (bold/italic/link, etc.)
  // sobre la selección actual y sincroniza el HTML resultante al estado `content`
  const format = (cmd: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
    setContent(editorRef.current?.innerHTML ?? '')
  }

  // Envuelve el texto seleccionado en un <blockquote> con estilo propio.
  // Se maneja aparte de `format` porque document.execCommand no tiene un
  // comando nativo de "cita" con el estilo visual que se quiere.
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
  // Handler del botón "Publicar nota" / "Guardar cambios".
  // 1) Valida campos obligatorios (título, contenido y categoría; el
  //    subtítulo, tags e imagen son opcionales) y si falta alguno,
  //    marca los campos en rojo y hace scroll al primero con error
  //    en vez de solo mostrar un mensaje genérico.
  // 2) Si pasa la validación: sube la imagen nueva (si hay), resuelve
  //    los tags a IDs de WordPress, y por último crea o actualiza el
  //    post según haya o no postId (POST /api/publicar para crear,
  //    PUT /api/posts/[id] para editar).
  const handlePublish = async () => {
    const errors: {title?: boolean; content?: boolean; category?: boolean} = {}
    if (!title.trim()) errors.title = true
    // content === '<br>' es lo que queda en un contentEditable "vacío" en
    // varios navegadores, por eso no alcanza con chequear string vacío
    if (!content.trim() || content === '<br>') errors.content = true
    if (!categoryId) errors.category = true

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setErrorMsg('Completá los campos marcados en rojo.')

      // Scroll al primer campo con error, siguiendo el orden visual del formulario
      if (errors.title) titleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else if (errors.category) categoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else if (errors.content) editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

      return
    }

    setFieldErrors({})
    setErrorMsg('')
    setStatus('loading')

    try {
      // 1. Subir imagen (solo si se seleccionó una nueva; si no, se conserva la existente)
      // featuredMediaId arranca en existingMediaId (0 si es nota nueva o no tenía imagen)
      // y solo se pisa si el usuario elige un archivo nuevo en este envío
      let featuredMediaId = existingMediaId
      if (image) {
        const fd = new FormData()
        fd.append('file', image)
        const mediaRes = await fetch('/api/media', { method: 'POST', body: fd })
        const mediaData = await mediaRes.json()
        if (!mediaRes.ok) throw new Error(mediaData.error?.message ?? 'Error al subir imagen')
        featuredMediaId = mediaData.id
      }

      // 2. Crear o actualizar post
      // Resolver IDs de tags (los tags se guardan como texto en el estado local
      // pero WordPress necesita IDs numéricos, ver resolveTagIds)
      const tagIds = await resolveTagIds(tags)

      // postId presente => editar (PUT a /api/posts/[id]); si no => crear (POST a /api/publicar)
      const postRes = await fetch(postId ? `/api/posts/${postId}` : '/api/publicar', {
        method: postId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, excerpt, content, categoryId, tags: tagIds, featuredMediaId }),
      })
      const postData = await postRes.json()
      if (!postRes.ok) throw new Error(postData.error?.message ?? (postId ? 'Error al guardar cambios' : 'Error al publicar'))

      setPublishedUrl(postData.url)
      setStatus('success')
      // Se avisa al padre apenas se confirma el guardado (no hace falta que
      // el usuario navegue a ningún lado) para que el listado de la derecha
      // se actualice solo y muestre la nota nueva/editada.
      onSaved()
    } catch (err: any) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  // ── Resolver tags (crear si no existen) ───────────────────
  // Convierte cada nombre de tag en su ID de WordPress llamando a
  // GET /api/tags?name=..., que busca el tag por nombre exacto y, si no
  // existe todavía en WP, lo crea. Se hace uno por uno (no hay endpoint
  // batch) justo antes de publicar, no al ir agregando tags en la UI.
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
  // En modo edición ofrece volver al modo "nota nueva" (el listado de la
  // derecha ya se actualizó solo, ver onSaved); en modo creación ofrece
  // resetear el formulario para publicar otra nota sin recargar la página.
  if (status === 'success') return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 text-center">
      <div className="text-5xl mb-4">✅</div>
      <h2 className="text-white text-2xl font-bold mb-2">{postId ? '¡Nota actualizada!' : '¡Nota publicada!'}</h2>
      <p className="text-gray-400 mb-6">{postId ? 'Los cambios ya están visibles en el sitio.' : 'La nota ya está visible en el sitio.'}</p>
      <a href={publishedUrl} target="_blank"
        className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition mb-3">
        Ver nota publicada
      </a>
      {postId ? (
        <button onClick={onExitEdit}
          className="block w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition">
          Listo, volver a nota nueva
        </button>
      ) : (
        <button onClick={() => { setStatus('idle'); setTitle(''); setExcerpt(''); setContent(''); setTags([]); setImage(null); setImagePreview(null); setCategoryId(null); setFieldErrors({}) }}
          className="block w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition">
          Publicar otra nota
        </button>
      )}
    </div>
  )

  // ── Formulario ────────────────────────────────────────────
  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5 md:p-6 h-fit">

      {/* Header del panel */}
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-semibold text-gray-200">{postId ? 'Editar nota' : 'Nueva nota'}</h2>
        {postId && (
          <button
            onClick={onExitEdit}
            className="ml-auto bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white text-sm px-4 py-2 rounded-xl transition"
          >
            Cancelar edición
          </button>
        )}
      </div>
      {loadingPost && <p className="text-sm text-blue-400 mb-4">Cargando nota...</p>}
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
          disabled={status === 'loading' || loadingPost}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed
            text-white font-bold py-4 rounded-xl transition text-lg"
        >
          {status === 'loading'
            ? (postId ? '⏳ Guardando...' : '⏳ Publicando...')
            : (postId ? 'Guardar cambios' : 'Publicar nota')}
        </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// LISTA DE NOTAS (editar / eliminar)
// ══════════════════════════════════════════════════════════════
// Notas de muestra para previsualizar la interfaz cuando no hay
// conexión a WordPress (solo se usan en desarrollo)
const DEMO_POSTS: PostItem[] = [
  { id: -1, title: '(Ejemplo) Argentina avanza en energías renovables', date: new Date().toISOString(), link: '#', thumbnail: null },
  { id: -2, title: '(Ejemplo) Nueva ley de medios entra en vigencia', date: new Date(Date.now() - 86400000).toISOString(), link: '#', thumbnail: null },
  { id: -3, title: '(Ejemplo) El dólar cierra la semana estable', date: new Date(Date.now() - 172800000).toISOString(), link: '#', thumbnail: null },
]

function ListaNotas({ onEditar, activeEditingId, refreshToken }: {
  onEditar: (id: number) => void
  activeEditingId: number | null // resalta en la lista la nota que se está editando en el panel de la izquierda
  refreshToken: number // se incrementa desde el padre al guardar una nota, para refrescar la lista sin depender de una navegación
}) {
  const [posts, setPosts] = useState<PostItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [deletingId, setDeletingId] = useState<number | null>(null) // id de la nota que se está eliminando, para deshabilitar solo su botón
  const [errorMsg, setErrorMsg] = useState('')

  // Trae una página de posts (con búsqueda opcional por título, y una
  // miniatura de la imagen destacada) desde GET /api/posts. Si la petición
  // falla y estamos en desarrollo, muestra notas de ejemplo (DEMO_POSTS) en
  // vez de dejar la pantalla rota, para poder trabajar en la UI sin
  // depender de la conexión real a WordPress.
  const fetchPosts = useCallback((p: number, s: string) => {
    setLoading(true)
    setErrorMsg('')
    const params = new URLSearchParams({ page: String(p) })
    if (s.trim()) params.set('search', s.trim())
    fetch(`/api/posts?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.error || !Array.isArray(data.posts)) throw new Error()
        setPosts(data.posts)
        setTotalPages(data.totalPages ?? 1)
      })
      .catch(() => {
        if (process.env.NODE_ENV === 'development') {
          setErrorMsg('Sin conexión a WordPress: mostrando notas de ejemplo (solo visible en desarrollo).')
          setPosts(DEMO_POSTS)
          setTotalPages(1)
        } else {
          setErrorMsg('Error al cargar las notas')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Se re-ejecuta al cambiar de página o cuando el formulario de la
  // izquierda avisa que guardó una nota (refreshToken); el filtro de
  // búsqueda se aplica manualmente con el botón "Buscar" (ver buscar()),
  // no en cada tecleo, para no golpear la API en cada carácter.
  useEffect(() => { fetchPosts(page, search) }, [page, refreshToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // Vuelve a la página 1 al buscar, porque los resultados filtrados
  // pueden tener menos páginas que el listado completo
  const buscar = () => {
    setPage(1)
    fetchPosts(1, search)
  }

  // Pide confirmación (WordPress manda la nota a la papelera, no la borra
  // definitivamente) y llama a DELETE /api/posts/[id]; si tiene éxito
  // recarga la página actual para reflejar la lista actualizada
  const handleDelete = async (post: PostItem) => {
    if (!window.confirm(`¿Eliminar la nota "${post.title}"?\nSe enviará a la papelera de WordPress.`)) return
    setDeletingId(post.id)
    setErrorMsg('')
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? 'Error al eliminar la nota')
      fetchPosts(page, search)
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5 md:p-6">

      {/* Header del panel */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Mis notas</h2>
      </div>

      {/* Buscador */}
      <div className="flex gap-2 mb-4">
        <input
          type="text" placeholder="Buscar por título..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          className="flex-1 bg-gray-900 rounded-xl px-4 py-3 placeholder-gray-600
            outline-none border-2 border-transparent focus:border-blue-500 transition text-sm"
        />
        <button
          onClick={buscar}
          className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl text-sm transition"
        >
          Buscar
        </button>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">
          {errorMsg}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-gray-500 text-sm">Cargando notas...</p>
      ) : posts.length === 0 ? (
        <p className="text-gray-500 text-sm">No se encontraron notas.</p>
      ) : (
        <div className="space-y-2">
          {posts.map(post => {
            const editing = post.id === activeEditingId
            return (
              <div key={post.id}
                className={`bg-gray-900 rounded-xl px-3 py-3 border-2 transition
                  ${editing ? 'border-blue-500' : 'border-transparent'}`}
              >
                <div className="flex items-start gap-3">
                  {/* Miniatura de la imagen destacada (o un ícono si no tiene) */}
                  <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center">
                    {post.thumbnail
                      ? <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
                      : <span className="text-gray-600 text-xl">📰</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-200 truncate"
                          dangerouslySetInnerHTML={{ __html: post.title || '<span class="italic text-gray-500">Sin título</span>' }} />
                        <p className="text-gray-500 text-xs mt-0.5">
                          {formatDate(post.date)}
                          {editing && <span className="text-blue-400 ml-2">· Editando ahora</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <a href={post.link} target="_blank"
                        className="text-teal-300 hover:text-teal-200 text-sm px-2 py-1 transition">
                        Ver
                      </a>
                      <button
                        onClick={() => onEditar(post.id)}
                        className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-1 rounded-lg transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(post)}
                        disabled={deletingId === post.id}
                        className="bg-red-900/50 hover:bg-red-800 text-red-300 text-sm px-3 py-1 rounded-lg
                          transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deletingId === post.id ? '...' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-xl text-sm transition
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>
          <span className="text-gray-500 text-sm">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-xl text-sm transition
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente →
          </button>
        </div>
      )}

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