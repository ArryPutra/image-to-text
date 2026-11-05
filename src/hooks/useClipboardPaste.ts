import { useEffect, useCallback } from 'react';

interface UseClipboardPasteOptions {
  onImagePasted: (file: File) => void;
  onTextPasteIgnored?: () => void;
  disabled?: boolean;
}

export function useClipboardPaste({
  onImagePasted,
  onTextPasteIgnored,
  disabled = false,
}: UseClipboardPasteOptions) {
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (disabled) return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items;
      let imageFile: File | null = null;
      let hasText = false;

      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
              const ext = item.type.split('/')[1] || 'png';
              const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
              const filename = blob.name && blob.name !== 'image.png'
                ? blob.name
                : `screenshot-${timestamp}.${ext}`;
              imageFile = new File([blob], filename, { type: blob.type });
              break;
            }
          } else if (item.kind === 'string' && item.type === 'text/plain') {
            hasText = true;
          }
        }
      }

      // Check fallback to clipboardData.files
      if (!imageFile && clipboardData.files && clipboardData.files.length > 0) {
        for (let i = 0; i < clipboardData.files.length; i++) {
          const file = clipboardData.files[i];
          if (file.type.startsWith('image/')) {
            imageFile = file;
            break;
          }
        }
      }

      const activeElement = document.activeElement as HTMLElement | null;
      const isTargetEditable =
        activeElement &&
        (activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'INPUT' ||
          activeElement.isContentEditable);

      if (imageFile) {
        // Image was found! Prevent default paste and process image
        e.preventDefault();
        e.stopPropagation();
        onImagePasted(imageFile);
      } else if (hasText && !isTargetEditable) {
        // Text was pasted while not inside an input
        onTextPasteIgnored?.();
      }
      // If hasText && isTargetEditable: allow native text paste to proceed normally
    },
    [disabled, onImagePasted, onTextPasteIgnored]
  );

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);
}
