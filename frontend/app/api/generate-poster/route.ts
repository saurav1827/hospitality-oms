import { NextRequest, NextResponse } from 'next/server'

// Appended to every user prompt to guarantee a professional, print-ready result.
const PROMPT_SUFFIX =
  ', high quality, beautiful composition, masterpiece, centered focal point for text overlay, photorealistic, 4k, cinematic lighting, interior design photography'

// Hosted NVIDIA NIM endpoint for black-forest-labs/flux.1-schnell (free trial tier).
// Reference: https://docs.api.nvidia.com/nim/reference/black-forest-labs-flux_1-schnell-infer
const NVIDIA_ENDPOINT = 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell'

// Keyless fallback so the studio still works if the NVIDIA trial key is
// missing, rate-limited, or the request otherwise fails.
const POLLINATIONS_ENDPOINT = 'https://image.pollinations.ai/prompt'

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function generateWithNvidia(prompt: string): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY is not configured')
  }

  const response = await fetchWithTimeout(
    NVIDIA_ENDPOINT,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        mode: 'base',   // text-to-image (no reference image)
        width: 1024,
        height: 1024,
        samples: 1,
        seed: 0,        // 0 = random seed each time
        steps: 4,       // max steps flux.1-schnell supports (1-4)
      }),
    },
    25_000
  )

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`NVIDIA API error ${response.status}: ${errorBody.slice(0, 300)}`)
  }

  const data = await response.json()
  const base64 = data?.artifacts?.[0]?.base64
  if (!base64) {
    throw new Error('NVIDIA API response did not include an image')
  }
  return base64
}

async function generateWithPollinations(prompt: string): Promise<string> {
  // Using model=flux ensures we get state-of-the-art FLUX.1 generation for free
  const imageUrl = `${POLLINATIONS_ENDPOINT}/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&model=flux`
  const response = await fetchWithTimeout(imageUrl, { method: 'GET' }, 25_000)

  if (!response.ok) {
    throw new Error(`Pollinations API error ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.startsWith('image/')) {
    throw new Error('Pollinations did not return an image')
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer).toString('base64')
}

export async function POST(req: NextRequest) {
  try {
    const { propertyName, locationName } = await req.json()

    if (!propertyName || !locationName) {
      return NextResponse.json({ error: 'Property name and location name are required' }, { status: 400 })
    }

    const basePrompt = `A luxurious, modern, and highly aesthetic interior design of ${propertyName}, specifically focusing on the ${locationName} area. The scene features elegant table decor, ambient warm lighting, and a small, tasteful, minimalist logo or subtle branding for "${propertyName}". The composition leaves a perfect centered focal point for a table tent or poster.`
    
    const enhancedPrompt = `${basePrompt}${PROMPT_SUFFIX}`

    try {
      const base64String = await generateWithPollinations(enhancedPrompt)
      return NextResponse.json({ b64_json: base64String, provider: 'pollinations-flux' })
    } catch (apiError) {
      console.error('Image generation failed:', apiError)
      throw apiError
    }

  } catch (error: any) {
    console.error('API Route Error:', error)
    const message = error?.name === 'AbortError'
      ? 'Image generation timed out. Please try again.'
      : 'Failed to generate image. Please try again.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}