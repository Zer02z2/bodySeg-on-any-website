import * as bodySegmentation from "@tensorflow-models/body-segmentation"
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection"
import "@tensorflow/tfjs-core"
import "@tensorflow/tfjs-backend-webgl"
import "@mediapipe/selfie_segmentation"
import "@mediapipe/hands"

let count = 0
const init = async () => {
  let canvases = []
  for (let i = 0; i < 2; i++) {
    const canvas = document.createElement("canvas")
    canvas.style.position = "fixed"
    canvas.style.bottom = "0px"
    canvas.style.scale = "1"
    //canvas.style.transform = "translateY(-110px)"
    canvas.style.left = `${window.innerWidth / 2 - 640 / 2}px`
    canvas.style.zIndex = "99"
    canvas.width = 640
    canvas.height = 480
    canvas.style.pointerEvents = "none"
    document.body.appendChild(canvas)
    canvases.push(canvas)
  }
  const video = await initWebcam()
  video.addEventListener("loadeddata", async () => {
    const bodySegmenter = await initBodySeg()
    const handDetector = await initHandPose()
    analyzeBody(bodySegmenter, video, canvases[0])
    analyzeHand(handDetector, video, canvases[1])
  })
}

const initWebcam = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true })
  const video = document.createElement("video")
  video.srcObject = stream
  video.play()
  video.width = 640
  video.height = 480
  return video
}

const initBodySeg = async () => {
  const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation
  const segmenterConfig: bodySegmentation.MediaPipeSelfieSegmentationMediaPipeModelConfig =
    {
      runtime: "mediapipe",
      solutionPath:
        "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation",
    }
  const segmenter = await bodySegmentation.createSegmenter(
    model,
    segmenterConfig
  )
  return segmenter
}

const initHandPose = async () => {
  const model = handPoseDetection.SupportedModels.MediaPipeHands
  const detectorConfig: handPoseDetection.MediaPipeHandsMediaPipeModelConfig = {
    runtime: "mediapipe",
    solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands",
    // or 'base/node_modules/@mediapipe/hands' in npm.
  }
  const detector = await handPoseDetection.createDetector(model, detectorConfig)
  return detector
}

const analyzeBody = async (
  segmenter: bodySegmentation.BodySegmenter,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
) => {
  const segmentationConfig = { flipHorizontal: false }
  const people = await segmenter.segmentPeople(video, segmentationConfig)

  const foregroundColor = { r: 0, g: 0, b: 0, a: 0 }
  const backgroundColor = { r: 0, g: 0, b: 0, a: 255 }
  const backgroundDarkeningMask = await bodySegmentation.toBinaryMask(
    people,
    foregroundColor,
    backgroundColor
  )

  const opacity = 1
  const maskBlurAmount = 3
  const flipHorizontal = true
  await bodySegmentation.drawMask(
    canvas,
    video,
    backgroundDarkeningMask,
    opacity,
    maskBlurAmount,
    flipHorizontal
  )

  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    if (r === 0 && g === 0 && b === 0 && a > 0) {
      data[i + 3] = 0
    }
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.putImageData(imageData, 0, 0)
  ctx.clearRect(0, 0, canvas.width * 0.02, canvas.height)
  ctx.clearRect(canvas.width * 0.98, 0, canvas.width * 0.02, canvas.height)
  ctx.clearRect(0, 0, canvas.width, canvas.height * 0.02)
  ctx.clearRect(0, canvas.height * 0.98, canvas.width, canvas.height * 0.02)

  window.requestAnimationFrame(() => {
    analyzeBody(segmenter, video, canvas)
  })
}

const analyzeHand = async (
  detector: handPoseDetection.HandDetector,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
) => {
  const estimationConfig = { flipHorizontal: true }
  const hands = await detector.estimateHands(video, estimationConfig)

  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  hands.forEach((hand) => {
    const vector1 = hand.keypoints[0]
    const vector2 = hand.keypoints[12]
    ctx.lineWidth = 1
    ctx.strokeStyle = "red"
    line(ctx, vector1.x, vector1.y, vector2.x, vector2.y)
  })

  window.requestAnimationFrame(() => {
    analyzeHand(detector, video, canvas)
  })
}

init()

const line = (
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}