import React, { useState, useCallback, useRef, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg, fileNameWithExt } from '../utils/imageUtils';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import { useTranslation } from 'react-i18next';

export default function ImageCropModal({ srcFile, onCancel, onSave, size = 200, mode = 'avatar' }) {
  const { t } = useTranslation();
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [previewDataUrl, setPreviewDataUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!srcFile) return;
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result);
    reader.readAsDataURL(srcFile);
  }, [srcFile]);

  const onCropComplete = useCallback((area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  // Generate a true cropped preview when croppedAreaPixels changes
  useEffect(() => {
    let mounted = true;
    let timer = null;
    if (!imageSrc || !croppedAreaPixels) {
      setPreviewDataUrl(null);
      return;
    }

    // Debounce preview generation to avoid excessive canvas operations while dragging
    timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const { dataUrl } = await getCroppedImg(imageSrc, croppedAreaPixels, 0, {
          maxDimension: size, // preview at target display size
          format: 'auto',
          quality: 0.8,
        });
        if (!mounted) return;
        setPreviewDataUrl(dataUrl);
      } catch (err) {
        console.error('Preview generation failed', err);
        if (mounted) setPreviewDataUrl(null);
      } finally {
        if (mounted) setPreviewLoading(false);
      }
    }, 200);

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [imageSrc, croppedAreaPixels]);

  const handleSave = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      const { blob, dataUrl, mime } = await getCroppedImg(imageSrc, croppedAreaPixels, 0, {
        maxDimension: mode === 'square' ? 768 : 1024,
        format: 'auto',
        quality: 0.85,
        maxBytes: 800 * 1024, // aim under ~800KB
      });
      // Convert blob to File with correct extension
      const desiredName = fileNameWithExt(srcFile?.name, mime);
      const file = new File([blob], desiredName, { type: mime });
      onSave && onSave({ file, dataUrl });
    } catch (err) {
      console.error('Crop error', err);
    }
  }, [imageSrc, croppedAreaPixels, onSave, srcFile]);

  const isSquare = mode === 'square';

  if (!srcFile) return null;

  return (
    <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100000, position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-dialog" style={{ maxWidth: 820, width: '96%' }}>
        <div className="modal-content" style={{ borderRadius: 12, overflow: 'hidden' }}>
          <div className="modal-header">
            <h5 className="modal-title">{t('image_crop_modal.title')}</h5>
            <button type="button" className="btn-close" onClick={onCancel}></button>
          </div>
          <div className="modal-body d-flex" style={{ gap: 16, padding: 12, alignItems: 'stretch' }}>
            <div style={{ position: 'relative', width: '70%', height: 420, background: '#333' }}>
              {imageSrc && (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>
            <div style={{ width: '30%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: size, height: size, borderRadius: isSquare ? 8 : '50%', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e9ecef' }}>
                {previewLoading ? (
                  <div className="spinner-border text-secondary" role="status" style={{ width: 36, height: 36 }}>
                    <span className="visually-hidden">{t('common.loading')}</span>
                  </div>
                ) : previewDataUrl ? (
                  <img src={previewDataUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : imageSrc ? (
                  <img src={imageSrc} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ color: '#888' }}>{t('image_crop_modal.preview')}</div>
                )}
              </div>
              <div style={{ width: '100%' }}>
                <label className="form-label">{t('image_crop_modal.zoom')}</label>
                <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="form-range" />
              </div>
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', gap: 8 }}>
            <SecondaryButton onClick={onCancel}>{t('common.cancel')}</SecondaryButton>
            <PrimaryButton onClick={handleSave}>{t('common.save')}</PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
