import { useMemo, useState } from 'react';

const DEFAULT_FACE = '/ansemify-face.png';
const DEFAULT_TEMPLATE = '/face-merge-template-example.png';

const RULES = [
  'Two images go to the image-editing model together.',
  'Image 1 is the feature/head/face source.',
  'Image 2 is the body, pose, outfit/object, lighting, and background template.',
  'The final preview shows only the generated merged image.',
];

async function urlToFile(url, name) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || 'image/png' });
}

function UploadInput({ title, description, previewUrl, fileName, onChange }) {
  return (
    <label className="model-upload-card">
      <input type="file" accept="image/*" onChange={onChange} />
      <img src={previewUrl} alt="" aria-hidden="true" />
      <span>{title}</span>
      <strong>{fileName || description}</strong>
    </label>
  );
}

export default function AnsemEpisodeApp() {
  const [faceFile, setFaceFile] = useState(null);
  const [templateFile, setTemplateFile] = useState(null);
  const [facePreview, setFacePreview] = useState(DEFAULT_FACE);
  const [templatePreview, setTemplatePreview] = useState(DEFAULT_TEMPLATE);
  const [outputUrl, setOutputUrl] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const canMerge = !!facePreview && !!templatePreview && status !== 'merging';
  const downloadName = useMemo(() => `ai-merged-image-${Date.now()}.png`, []);

  async function handleFaceUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFaceFile(file);
    setFacePreview(URL.createObjectURL(file));
    setOutputUrl('');
    event.target.value = '';
  }

  async function handleTemplateUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setTemplateFile(file);
    setTemplatePreview(URL.createObjectURL(file));
    setOutputUrl('');
    event.target.value = '';
  }

  async function runMerge() {
    setStatus('merging');
    setError('');
    setOutputUrl('');

    try {
      const form = new FormData();
      form.append('face', faceFile || await urlToFile(DEFAULT_FACE, 'default-face.png'));
      form.append('template', templateFile || await urlToFile(DEFAULT_TEMPLATE, 'default-template.png'));

      const response = await fetch('/api/face-merge', {
        method: 'POST',
        body: form,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Merge failed with status ${response.status}`);
      }

      setOutputUrl(payload.imageUrl);
      setStatus('done');
    } catch (err) {
      setError(err.message || 'Image merge failed.');
      setStatus('error');
    }
  }

  return (
    <main className="model-merge-page">
      <section className="model-merge-shell" aria-labelledby="model-merge-title">
        <div className="model-merge-copy">
          <p className="model-merge-kicker">AI image editing, not overlay</p>
          <h1 id="model-merge-title">Image Merge</h1>
          <p>
            Upload two images. The backend sends both to an image editing model and returns one generated merged image using both references.
          </p>

          <div className="model-upload-grid">
            <UploadInput
              title="Image 1"
              description="Feature / face source"
              previewUrl={facePreview}
              fileName={faceFile?.name}
              onChange={handleFaceUpload}
            />
            <UploadInput
              title="Image 2"
              description="Template / body source"
              previewUrl={templatePreview}
              fileName={templateFile?.name}
              onChange={handleTemplateUpload}
            />
          </div>

          <button className="model-merge-button" type="button" disabled={!canMerge} onClick={runMerge}>
            {status === 'merging' ? 'Merging with AI...' : 'Generate merged image'}
          </button>

          {error && <p className="model-merge-error">{error}</p>}

          <div className="model-merge-rules">
            {RULES.map((rule) => (
              <article key={rule}>
                <span />
                <p>{rule}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="model-output-panel">
          <div className="model-output-topbar">
            <span>{outputUrl ? 'Generated merged image' : 'Final output only'}</span>
            {outputUrl && <a href={outputUrl} download={downloadName}>Download</a>}
          </div>

          {outputUrl ? (
            <img src={outputUrl} alt="AI generated merged image output" />
          ) : (
            <div className="model-output-empty">
              <h2>No overlay canvas here.</h2>
              <p>The final image appears here only after the model returns one merged image.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
