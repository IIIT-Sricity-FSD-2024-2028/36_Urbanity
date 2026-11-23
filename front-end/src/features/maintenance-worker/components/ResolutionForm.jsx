import { useRef, useState } from "react";
import { Button, Card, ErrorState, Input, Textarea } from "../../../components/ui/index.js";
import { useAppDispatch } from "../../../app/reduxHooks.js";
import { useAuth } from "../../../auth/useAuth.js";
import { useWorkerMutation } from "../hooks/useWorkerMutation.js";
import { uploadWorkerProof, useResolveMaintenanceWorkerTaskMutation } from "../services/workerTasksApi.js";
import { IMAGE_TYPES, validateProofFile } from "../utils/workflow.js";

export function ResolutionForm({ taskId, attachments, disabled }) {
  const [problemFound, setProblemFound] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [file, setFile] = useState(null);
  const [validation, setValidation] = useState("");
  const fileInput = useRef(null);
  const mutation = useWorkerMutation();
  const dispatch = useAppDispatch();
  const { sessionRevision } = useAuth();
  const [resolveTask] = useResolveMaintenanceWorkerTaskMutation();
  const proof = attachments.filter((item) => item.purpose === "RESOLUTION_PROOF" && item.uploadedByRole === "MAINTENANCE_WORKER");
  const proofIds = selectedIds.filter((id) => proof.some((item) => item.id === id));
  const busy = disabled || mutation.pending;

  function selectFile(event) {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setValidation(selected ? validateProofFile(selected) : "");
  }

  function upload() {
    const error = validateProofFile(file);
    setValidation(error);
    if (busy || error) return;
    let uploaded;
    mutation.run(async () => { uploaded = await uploadWorkerProof(dispatch, taskId, file); }, "Proof image uploaded.", async () => {
      setSelectedIds((current) => [...new Set([...current, uploaded.id])]);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    });
  }

  function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!problemFound.trim() || !resolutionSummary.trim() || !proofIds.length) {
      setValidation("Describe the problem and resolution, and select at least one uploaded proof image.");
      return;
    }
    setValidation("");
    mutation.run(() => resolveTask({ id: taskId, sessionRevision, problemFound, resolutionSummary, proofAttachmentIds: proofIds }).unwrap(),
      "Work submitted for authority verification.");
  }

  return <Card title="Submit resolution proof">
    <form className="mw-form" onSubmit={submit}>
      <p>Upload proof images, select the images to include, and describe your work. Your community authority will verify the resolution.</p>
      <Textarea label="Problem found" value={problemFound} onChange={(event) => setProblemFound(event.target.value)} maxLength={2000} required disabled={busy} />
      <Textarea label="Resolution summary" value={resolutionSummary} onChange={(event) => setResolutionSummary(event.target.value)} maxLength={2000} required disabled={busy} />
      <Input ref={fileInput} label={<>Proof image <span className="ui-field__required">*</span></>} type="file" accept={IMAGE_TYPES.join(",")} onChange={selectFile} disabled={busy}
        hint="JPEG, PNG, or WebP. Maximum 5 MB per image. Upload additional images one at a time." />
      {file && <p className="mw-secondary">Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
      <Button variant="secondary" onClick={upload} disabled={busy || !file || Boolean(validateProofFile(file))}>Upload image</Button>
      {proof.length > 0 && <fieldset className="mw-proof-selection" disabled={busy}>
        <legend>Uploaded proof to include</legend>
        {proof.map((attachment) => <label key={attachment.id}>
          <input type="checkbox" checked={proofIds.includes(attachment.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, attachment.id])] : current.filter((id) => id !== attachment.id))} />
          {attachment.originalName || "Uploaded proof image"}
        </label>)}
      </fieldset>}
      {validation && <p role="alert">{validation}</p>}
      {mutation.error && <ErrorState message={mutation.error} />}
      <Button type="submit" loading={mutation.pending} loadingLabel="Saving work..." disabled={busy || !proofIds.length}>Submit for verification</Button>
    </form>
  </Card>;
}
