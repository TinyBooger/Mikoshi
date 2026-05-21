import React, { useState, useCallback, useRef, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg, fileNameWithExt } from '../utils/imageUtils';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import { useTranslation } from 'react-i18next';

export default function ImageCropModal({ srcFile, onCancel, onSave, size = 200, mode = 'avatar', hideOriginal = false }) {
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 600);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const [imageSrc, setImageSrc] = useState(null);
  const [originalImgRatio, setOriginalImgRatio] = useState(null);
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
  const originalTitle = '角色封面';
  const originalDescription = isSquare
    ? t('image_crop_modal.original_desc_square')
    : t('image_crop_modal.original_desc_avatar');
  const cropTitle = isSquare
    ? t('image_crop_modal.crop_title_square')
    : t('image_crop_modal.crop_title_avatar');
  const cropDescription = isSquare
    ? t('image_crop_modal.crop_desc_square')
    : t('image_crop_modal.crop_desc_avatar');

  if (!srcFile) return null;

  return (
    <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100000, position: 'fixed', inset: 0, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? '0 12px' : undefined }}>
      <div className="modal-dialog" style={{ maxWidth: 820, width: '100%', margin: isMobile ? '16px 0' : undefined }}>        
        <div className="modal-content" style={{ borderRadius: isMobile ? 16 : 12, overflow: 'hidden' }}>
          <div className="modal-header">
            <h5 className="modal-title">{t('image_crop_modal.title')}</h5>
            <button type="button" className="btn-close" onClick={onCancel}></button>
          </div>
          <div className="modal-body" style={{ padding: 12, overflowY: 'auto', maxHeight: isMobile ? '80vh' : '75vh' }}>
            <div
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'stretch',
                flexWrap: 'wrap',
              }}
            >
              {!isMobile && !hideOriginal && (
              <div style={{ flex: '1 1 300px', minWidth: 280 }}>
                <div className="fw-semibold" style={{ marginBottom: 4 }}>{originalTitle}</div>
                <div className="text-muted" style={{ fontSize: '0.82rem', marginBottom: 8 }}>{originalDescription}</div>
                <div style={{
                  width: '100%',
                  aspectRatio: originalImgRatio ? String(originalImgRatio) : '4 / 3',
                  maxHeight: 480,
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  background: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={t('image_crop_modal.original_preview_alt')}
                      onLoad={e => {
                        const r = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight;
                        if (Number.isFinite(r) && r > 0) setOriginalImgRatio(r);
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ color: '#888' }}>{t('image_crop_modal.preview')}</div>
                  )}
                </div>
              </div>
              )}

              <div style={{ flex: '1.2 1 360px', minWidth: 0, width: '100%' }}>
                <div className="fw-semibold" style={{ marginBottom: 4 }}>{cropTitle}</div>
                <div className="text-muted" style={{ fontSize: '0.82rem', marginBottom: 8 }}>{cropDescription}</div>
                <div style={{ position: 'relative', width: '100%', height: isMobile ? 240 : 320, background: '#333', borderRadius: 10, overflow: 'hidden', touchAction: 'none' }}>
                  {imageSrc && (
                    <Cropper
                      image={imageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      cropShape={isSquare ? 'rect' : 'round'}
                      showGrid={false}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    aria-label="缩小"
                    onClick={() => setZoom(z => Math.max(1, parseFloat((z - 0.1).toFixed(2))))}
                    style={{
                      width: 44, height: 44, borderRadius: '50%',
                      border: '1.5px solid #e9ecef', background: '#f5f6fa',
                      fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, touchAction: 'manipulation',
                    }}
                  >−</button>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: '0.88rem', color: '#6b7280', userSelect: 'none' }}>
                    {Math.round((zoom - 1) / 2 * 100)}%
                  </div>
                  <button
                    type="button"
                    aria-label="放大"
                    onClick={() => setZoom(z => Math.min(3, parseFloat((z + 0.1).toFixed(2))))}
                    style={{
                      width: 44, height: 44, borderRadius: '50%',
                      border: '1.5px solid #e9ecef', background: '#f5f6fa',
                      fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, touchAction: 'manipulation',
                    }}
                  >+</button>
                </div>

                <div style={{ marginTop: 8 }}>
                  <div className="text-muted" style={{ fontSize: '0.78rem', marginBottom: 6 }}>{t('image_crop_modal.avatar_preview_label')}</div>
                  <div style={{ width: size, height: size, borderRadius: isSquare ? 8 : '50%', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #e9ecef' }}>
                    {previewLoading ? (
                      <div className="spinner-border text-secondary" role="status" style={{ width: 36, height: 36 }}>
                        <span className="visually-hidden">{t('common.loading')}</span>
                      </div>
                    ) : previewDataUrl ? (
                      <img src={previewDataUrl} alt={t('image_crop_modal.cropped_preview_alt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : imageSrc ? (
                      <img src={imageSrc} alt={t('image_crop_modal.cropped_preview_alt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ color: '#888' }}>{t('image_crop_modal.preview')}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', gap: 8 }}>
            <SecondaryButton onClick={onCancel}>{t('image_crop_modal.cancel')}</SecondaryButton>
            <PrimaryButton onClick={handleSave}>{t('image_crop_modal.save')}</PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
