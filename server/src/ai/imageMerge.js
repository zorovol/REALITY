import { config } from '../config.js';

const OPENAI_IMAGE_EDIT_URL = 'https://api.openai.com/v1/images/edits';
const IMAGE_MODEL = process.env.IMAGE_EDIT_MODEL || 'gpt-image-1';

function fileToBlob(file) {
  return new Blob([file.buffer], { type: file.mimetype || 'image/png' });
}

export async function mergeImagesWithModel({ faceFile, templateFile }) {
  if (!config.openaiKey) {
    const error = new Error('OPENAI_API_KEY is required for AI image editing.');
    error.status = 501;
    throw error;
  }

  const form = new FormData();
  form.append('model', IMAGE_MODEL);
  form.append('image[]', fileToBlob(faceFile), faceFile.originalname || 'face.png');
  form.append('image[]', fileToBlob(templateFile), templateFile.originalname || 'template.png');
  form.append('size', 'auto');
  form.append('quality', process.env.IMAGE_EDIT_QUALITY || 'medium');
  form.append('output_format', 'png');
  form.append(
    'prompt',
    [
      'Create one seamless merged image using the two provided image inputs.',
      'Image 1 is the source head/face/creature/object identity reference.',
      'Image 2 is the template body, pose, clothing/object, perspective, lighting, and background reference.',
      'Use image editing/inpainting behavior, not a collage and not a pasted overlay.',
      'Replace only the template head/face region with the source head/face/creature/object features from Image 1.',
      'Preserve the actual template body, pose, clothing/object, lighting, perspective, and background from Image 2.',
      'Do not generate a new body. Do not redraw the entire image. Do not place the two originals side by side.',
      'Blend the replacement naturally with matching lighting, shadows, scale, and neck/edge transitions.',
      'Return only the final merged photorealistic image.',
    ].join(' '),
  );

  const response = await fetch(OPENAI_IMAGE_EDIT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiKey}`,
    },
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Image edit failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const image = payload?.data?.[0];
  if (image?.b64_json) {
    return {
      imageUrl: `data:image/png;base64,${image.b64_json}`,
      revisedPrompt: image.revised_prompt || '',
    };
  }

  if (image?.url) {
    return {
      imageUrl: image.url,
      revisedPrompt: image.revised_prompt || '',
    };
  }

  const error = new Error('Image edit model did not return an image.');
  error.status = 502;
  throw error;
}
