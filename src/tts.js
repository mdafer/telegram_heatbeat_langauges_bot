import { MsEdgeTTS } from 'msedge-tts'

const VOICES = {
  spanish: 'es-ES-ElviraNeural',
  french: 'fr-FR-DeniseNeural',
  german: 'de-DE-KatjaNeural',
  italian: 'it-IT-ElsaNeural',
  portuguese: 'pt-BR-FranciscaNeural',
  japanese: 'ja-JP-NanamiNeural',
  korean: 'ko-KR-SunHiNeural',
  chinese: 'zh-CN-XiaoxiaoNeural',
  mandarin: 'zh-CN-XiaoxiaoNeural',
  cantonese: 'zh-HK-HiuGaaiNeural',
  arabic: 'ar-SA-ZariyahNeural',
  russian: 'ru-RU-SvetlanaNeural',
  hindi: 'hi-IN-SwaraNeural',
  turkish: 'tr-TR-EmelNeural',
  dutch: 'nl-NL-ColetteNeural',
  polish: 'pl-PL-AgnieszkaNeural',
  swedish: 'sv-SE-SofieNeural',
  thai: 'th-TH-PremwadeeNeural',
  vietnamese: 'vi-VN-HoaiMyNeural',
  greek: 'el-GR-AthinaNeural',
  hebrew: 'he-IL-HilaNeural',
  indonesian: 'id-ID-GadisNeural',
  malay: 'ms-MY-YasminNeural',
  english: 'en-US-EmmaMultilingualNeural',
}

const getVoice = (language) => {
  const lang = (language || '').toLowerCase()
  return Object.entries(VOICES).find(([k]) => lang.includes(k))?.[1]
    || 'en-US-EmmaMultilingualNeural'
}

export const synthesize = async (text, language) => {
  const tts = new MsEdgeTTS()
  await tts.setMetadata(getVoice(language), 'audio-24khz-48kbitrate-mono-mp3')
  const { audioStream } = tts.toStream(text)
  const bufs = []
  for await (const chunk of audioStream) bufs.push(chunk)
  return Buffer.concat(bufs)
}
