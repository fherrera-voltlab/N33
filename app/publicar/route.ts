const body = await req.json()
console.log('BODY RECIBIDO:', JSON.stringify(body, null, 2))
const { title, excerpt, content, categoryId, tags, featuredMediaId } = body