import { useState, useRef, useCallback } from 'react'
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import Button from './Button'

interface Props {
  src: string
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

function centerSquareCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 80 }, 1, width, height),
    width,
    height
  )
}

async function cropToBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  // Output at natural resolution, capped at 1024 px to keep file size sane
  const outputSize = Math.min(Math.round(crop.width * scaleX), 1024)
  const ratio = outputSize / (crop.width * scaleX)

  canvas.width = outputSize
  canvas.height = Math.round(crop.height * scaleY * ratio)

  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas empty'))),
      'image/jpeg',
      0.92
    )
  })
}

export default function ImageCropModal({ src, onConfirm, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [aspect, setAspect] = useState<number | undefined>(1)
  const [processing, setProcessing] = useState(false)

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    setCrop(centerSquareCrop(width, height))
  }, [])

  async function handleConfirm() {
    if (!imgRef.current || !completedCrop) return
    setProcessing(true)
    try {
      const blob = await cropToBlob(imgRef.current, completedCrop)
      onConfirm(blob)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/90 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-lg shadow-xl flex flex-col max-w-2xl w-full max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-heading text-lg text-ink">Crop image</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-faint font-mono">Aspect:</span>
            {[
              { label: '1:1', value: 1 },
              { label: '4:3', value: 4 / 3 },
              { label: 'Free', value: undefined },
            ].map(({ label, value }) => (
              <button
                key={label}
                onClick={() => setAspect(value)}
                className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${
                  aspect === value
                    ? 'border-blood text-blood bg-blood/10'
                    : 'border-border text-ink-faint hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Crop area */}
        <div className="overflow-auto flex-1 flex items-center justify-center bg-void p-4">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            minWidth={50}
            minHeight={50}
          >
            <img
              ref={imgRef}
              src={src}
              onLoad={onImageLoad}
              className="max-h-[55vh] max-w-full object-contain"
              alt="crop preview"
            />
          </ReactCrop>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border shrink-0">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            loading={processing}
            disabled={!completedCrop?.width || !completedCrop?.height}
          >
            Apply crop
          </Button>
        </div>
      </div>
    </div>
  )
}
