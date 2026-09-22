import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, ErrorState, Input, LoadingState, Select, Textarea, useToast } from "../../../components/ui/index.js";
import { PageHeader } from "../../../components/data-display/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { AttachmentPicker } from "../components/AttachmentPicker.jsx";
import { ResidentLocation } from "../components/ResidentLocation.jsx";
import { useResidentResource } from "../hooks/useResidentResource.js";
import { residentService } from "../services/residentService.js";
import { COMPLAINT_TYPES, WORK_TYPES, label, validateImages } from "../utils.js";

export function CreateComplaintPage() {
  const hierarchy = useResidentResource(residentService.getHierarchy);
  const [values, setValues] = useState({ type: "", requiredWorkType: "", title: "", description: "" });
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const field = (name) => ({ value: values[name], onChange: (event) => setValues((current) => ({ ...current, [name]: event.target.value })), error: errors[name], disabled: submitting });

  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const payload = { ...values, title: values.title.trim(), description: values.description.trim() };
    const nextErrors = {};
    if (!COMPLAINT_TYPES.includes(payload.type)) nextErrors.type = "Choose a complaint type.";
    if (!WORK_TYPES.includes(payload.requiredWorkType)) nextErrors.requiredWorkType = "Choose a work type.";
    if (!payload.title || payload.title.length > 200) nextErrors.title = "Enter a title of 1–200 characters.";
    if (!payload.description || payload.description.length > 2000) nextErrors.description = "Enter a description of 1–2000 characters.";
    const imageError = validateImages(files);
    setErrors(nextErrors);
    setFileError(imageError);
    if (Object.keys(nextErrors).length || imageError) return;
    lock.current = true;
    setSubmitting(true);
    try {
      const complaint = await residentService.createComplaint(payload);
      const results = await Promise.allSettled(files.map((file) => residentService.uploadAttachment(complaint.id, file)));
      const failures = results.flatMap((result, index) => result.status === "rejected" ? [`${files[index].name}: ${result.reason.message}`] : []);
      showToast({ type: "success", message: "Complaint created." });
      // Details performs a fresh read, including the successful attachments.
      navigate(`${ROUTES.RESIDENT_COMPLAINTS}/${complaint.id}`, { replace: true, state: { uploadFailures: failures } });
    } catch (error) {
      setErrors({ form: error.message });
      showToast({ type: "error", message: error.message });
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  }

  return <div className="resident-stack">
    <PageHeader title="Create complaint" description="Describe the issue so your maintenance team can help." />
    {hierarchy.loading ? <LoadingState message="Loading your apartment..." /> : hierarchy.error ? <ErrorState message={hierarchy.error.message} onRetry={hierarchy.reload} /> : <ResidentLocation hierarchy={hierarchy.data} />}
    <Card title="Complaint details"><form className="resident-stack" onSubmit={submit} noValidate>
      {errors.form && <ErrorState title="Unable to create complaint" message={errors.form} />}
      <div className="resident-grid">
        <Select label="Complaint type" required {...field("type")}><option value="">Select type</option>{COMPLAINT_TYPES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</Select>
        <Select label="Required work type" required {...field("requiredWorkType")}><option value="">Select work type</option>{WORK_TYPES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</Select>
      </div>
      <Input label="Title" maxLength={200} required {...field("title")} />
      <Textarea label="Description" rows={6} maxLength={2000} required {...field("description")} hint="Include the location, symptoms, and when the issue started." />
      <AttachmentPicker files={files} onChange={setFiles} error={fileError} onError={setFileError} disabled={submitting} />
      <div className="resident-actions">
        {!submitting && <Link className="ui-button ui-button--secondary" to={ROUTES.RESIDENT_COMPLAINTS}>Cancel</Link>}
        <Button type="submit" loading={submitting} loadingLabel="Submitting complaint..." disabled={!hierarchy.data || hierarchy.loading || Boolean(hierarchy.error)}>Submit complaint</Button>
      </div>
    </form></Card>
  </div>;
}
