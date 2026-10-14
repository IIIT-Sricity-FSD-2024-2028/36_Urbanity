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
    <PageHeader title="Report an issue" description="A few details help the right person get started." />
    <div className="resident-form-layout">
    <Card title="What needs attention?"><form className="resident-stack" onSubmit={submit} noValidate>
      {errors.form && <ErrorState title="Unable to create complaint" message={errors.form} />}
      <div className="resident-grid">
        <Select label="Where is the issue?" required {...field("type")}><option value="">Choose an area</option>{COMPLAINT_TYPES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</Select>
        <Select label="What kind of work is needed?" required {...field("requiredWorkType")}><option value="">Choose a work type</option>{WORK_TYPES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</Select>
      </div>
      <Input label="Give the issue a short title" placeholder="For example, water leaking below the kitchen sink" maxLength={200} required {...field("title")} />
      <Textarea label="Tell us what's happening" rows={6} maxLength={2000} required {...field("description")} hint="Include the exact spot, what you noticed, and when it started." />
      <div className="resident-upload-area"><AttachmentPicker files={files} onChange={setFiles} error={fileError} onError={setFileError} disabled={submitting} /></div>
      <div className="resident-actions">
        {!submitting && <Link className="ui-button ui-button--secondary" to={ROUTES.RESIDENT_COMPLAINTS}>Cancel</Link>}
        <Button type="submit" loading={submitting} loadingLabel="Sending report..." disabled={!hierarchy.data || hierarchy.loading || Boolean(hierarchy.error)}>Send report</Button>
      </div>
    </form></Card>
    <aside className="resident-stack">
      {hierarchy.loading ? <LoadingState message="Loading your apartment..." /> : hierarchy.error ? <ErrorState message={hierarchy.error.message} onRetry={hierarchy.reload} /> : <ResidentLocation hierarchy={hierarchy.data} />}
      <section className="resident-how-it-works"><h2>A useful report includes</h2><ul><li>The exact place that needs attention.</li><li>What is damaged or not working.</li><li>A clear photo, if you have one.</li></ul><p className="resident-note">Apartment and tower issues go to your Tower Representative. Community issues go to your Community Admin.</p></section>
    </aside>
    </div>
  </div>;
}
