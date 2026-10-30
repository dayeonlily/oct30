// Vercel 함수: GET /api/config — 화면이 켜야 할 선택 기능만 알려 준다(키 값은 내보내지 않는다).
export default function handler(req, res) {
  const imagesEnabled = !!(String(process.env.PIXABAY_API_KEY ?? '').trim() && String(process.env.BLOB_READ_WRITE_TOKEN ?? '').trim());
  res.setHeader('Cache-Control', 'public, s-maxage=300');
  res.status(200).json({ imagesEnabled, feedbackEmail: String(process.env.FEEDBACK_EMAIL ?? '').trim() || null });
}
