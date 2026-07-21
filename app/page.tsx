// NewsForm es un Client Component ('use client' en app/news.tsx): maneja estado
// de formulario en el navegador (título, medios, tags, etc.) para crear notas.
import NewsForm from './news';

// Página principal ("/"). Es un Server Component (no tiene 'use client' ni fetch
// propio), pero no hace ningún trabajo de servidor: solo delega todo el render
// y la lógica al componente cliente NewsForm. No hay listado de noticias ni
// fetch a WordPress acá; los datos/las llamadas a la API viven dentro de NewsForm
// (y de forma más completa en app/publicar/page.tsx).
export default function Home() {
  return <NewsForm />;
}
