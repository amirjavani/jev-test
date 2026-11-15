import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { readImage } from './image-upload.js';

export default function ImageUpload({ images, setImages, running, busy, setBusy, batch, onExample, onLoadExample }) {
  const input = useRef(null);
  const [error, setError] = useState('');
  async function loadExample(kind) {
    setError('');
    try { await onLoadExample(kind); } catch (e) { setError(e.message); }
  }
  async function upload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError(''); setBusy(true);
    try {
      // All-or-nothing: a bad file leaves the existing selection intact.
      const additions = [];
      for (const file of files) additions.push(await readImage(file));
      setImages(current => [...current, ...additions]);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="image-upload">
    <div className="label-row"><label htmlFor="image-files">Images <span className="label-note">optional · PNG / JPEG</span></label><span className="count">{images.length}</span></div>
    <input ref={input} id="image-files" type="file" multiple accept=".png,.jpg,.jpeg,image/png,image/jpeg" disabled={running || busy} onChange={upload} />
    <div className="image-actions"><button disabled={running || busy} onClick={() => input.current.click()}><ImagePlus size={15} />{busy ? 'Preparing images…' : 'Upload images'}</button><button disabled={running || busy} onClick={onExample}>Use image test questions</button></div>
    <div className="image-actions"><button disabled={running || busy} onClick={() => loadExample('red-circle')}>Load red circle example</button><button disabled={running || busy} onClick={() => loadExample('blue-square')}>Load blue square example</button></div>
    <p className="field-hint">Up to 16 MB per file. Large images resize automatically; small images get white padding. {batch ? 'These images accompany every text in the list.' : 'Images accompany your state as shared context.'} Ask about the pictures in <code>images</code>.</p>
    <p className="field-hint">Image support is experimental. “Use image test questions” replaces the current questions with color and shape checks.</p>
    <p className="field-hint">Image examples replace the current picture, state, and questions, and select their reference answers.</p>
    {error && <p className="library-error" role="alert">{error}</p>}
    {images.length > 0 && <div className="image-previews">{images.map(image => <figure key={image.id}><img src={image.preview} alt={`Upload: ${image.name}`} /><figcaption><span title={image.name}>{image.name}</span><small>{image.width} × {image.height}{image.resized ? ' · resized / padded' : ''}</small><button disabled={running || busy} className="icon-button danger" aria-label={`Remove image ${image.name}`} onClick={() => setImages(current => current.filter(item => item.id !== image.id))}><Trash2 size={15} /></button></figcaption></figure>)}</div>}
  </div>;
}
