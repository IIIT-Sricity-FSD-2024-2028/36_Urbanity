import { Input } from "../../../components/ui/index.js";
import { IMAGE_TYPES, validateImages } from "../utils.js";

export function AttachmentPicker({ files, onChange, error, onError, disabled, inputKey }) {
  return <div className="resident-stack">
    <Input key={inputKey} label="Supporting images (optional)" type="file" multiple accept={IMAGE_TYPES.join(",")} disabled={disabled}
      hint="JPEG, PNG, or WebP only; up to 5 MB per image." error={error}
      onChange={(event) => {
        const selected = Array.from(event.target.files);
        const message = validateImages(selected);
        onError(message);
        onChange(message ? [] : selected);
        if (message) event.target.value = "";
      }} />
    {files.length > 0 && <ul className="resident-file-list">{files.map((file, index) => <li key={`${file.name}-${index}`}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</li>)}</ul>}
  </div>;
}
