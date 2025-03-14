'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
}

export function ImageUploadModal({ isOpen, onClose, onUpload }: ImageUploadModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    imageRef.current = e.currentTarget;
    // Set initial crop to maintain aspect ratio
    const { width, height } = e.currentTarget;
    const aspect = width / height;
    let newCrop: Crop = {
      unit: '%',
      width: 100,
      height: 100 / aspect,
      x: 0,
      y: 0,
    };
    if (newCrop.height > 100) {
      newCrop = {
        unit: '%',
        width: 100 * aspect,
        height: 100,
        x: 0,
        y: 0,
      };
    }
    setCrop(newCrop);
  };

  const getCroppedImage = (): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!imageRef.current) {
        reject(new Error('No image loaded'));
        return;
      }

      const canvas = document.createElement('canvas');
      const scaleX = imageRef.current.naturalWidth / imageRef.current.width;
      const scaleY = imageRef.current.naturalHeight / imageRef.current.height;
      const pixelRatio = window.devicePixelRatio;
      
      canvas.width = Math.floor(crop.width * scaleX);
      canvas.height = Math.floor(crop.height * scaleY);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No 2d context'));
        return;
      }

      ctx.scale(pixelRatio, pixelRatio);
      ctx.imageSmoothingQuality = 'high';

      const cropX = crop.x * scaleX;
      const cropY = crop.y * scaleY;

      ctx.drawImage(
        imageRef.current,
        cropX,
        cropY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width * scaleX,
        crop.height * scaleY,
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          const file = new File([blob], 'cropped-image.png', {
            type: 'image/png',
          });
          resolve(file);
        },
        'image/png',
        1,
      );
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    try {
      setIsLoading(true);
      const croppedFile = await getCroppedImage();
      await onUpload(croppedFile);
      onClose();
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Profile Picture</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!selectedImage ? (
            <div className="flex flex-col items-center justify-center gap-4">
              <label className="cursor-pointer">
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-gray-400">
                  <p>Click to select an image</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          ) : (
            <>
              <div className="relative aspect-square max-h-[300px] overflow-hidden rounded-lg">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  aspect={1}
                  circularCrop
                >
                  <img
                    src={selectedImage}
                    alt="Upload preview"
                    onLoad={handleImageLoad}
                    className="max-h-[300px] w-full object-contain"
                  />
                </ReactCrop>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedImage(null);
                    setCrop({
                      unit: '%',
                      width: 100,
                      height: 100,
                      x: 0,
                      y: 0,
                    });
                  }}
                  disabled={isLoading}
                >
                  Discard
                </Button>
                <Button onClick={handleUpload} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Upload
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 