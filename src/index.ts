import { config } from 'dotenv'
import fs from 'fs'
// @ts-ignore
import mic from 'mic'
import OpenAI from 'openai'
// @ts-ignore
import vosk from 'vosk'

config()

const MODEL_PATH = 'model'
const SAMPLE_RATE = 16000

if (!fs.existsSync(MODEL_PATH)) {
  console.log(
    'Please download the model from https://alphacephei.com/vosk/models and unpack as ' +
      MODEL_PATH +
      ' in the current folder.'
  )
  process.exit(1)
}

vosk.setLogLevel(0)
const model = new vosk.Model(MODEL_PATH)
const recognizer = new vosk.Recognizer({
  model,
  sampleRate: SAMPLE_RATE
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

var micInstance = mic({
  rate: String(SAMPLE_RATE),
  channels: '1',
  debug: false,
  device: 'default'
})

var micInputStream = micInstance.getAudioStream()

micInputStream.on('data', async (data: any) => {
  if (recognizer.acceptWaveform(data)) {
    const text = recognizer.result().text
    if (!text) return
    console.log({ text })
    const result = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a sarcastic assistant.' },
        {
          role: 'user',
          content: text
        }
      ]
    })
    console.log('Result', result.choices[0]?.message.content)
  } else {
    console.log(recognizer.partialResult().partial)
  }
})

micInputStream.on('audioProcessExitComplete', function () {
  console.log('Cleaning up')
  console.log(recognizer.finalResult())
  recognizer.free()
  model.free()
})

process.on('SIGINT', function () {
  console.log('\nStopping')
  micInstance.stop()
})

micInstance.start()
