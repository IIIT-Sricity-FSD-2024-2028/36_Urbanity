import { useCallback, useRef, useState } from "react";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, Card, EmptyState, ErrorState, LoadingState, StarRatingInput, Textarea, useToast } from "../../../components/ui/index.js";
import { RatingStars } from "../../../components/data-display/index.js";
import { useResidentResource } from "../hooks/useResidentResource.js";
import { residentService } from "../services/residentService.js";
import { dateTime } from "../utils.js";

const ratings = [["speedRating", "Speed"], ["qualityRating", "Quality"], ["communicationRating", "Communication"]];

export function ComplaintReview({ complaint, onReviewed }) {
  const { user } = useAuth();
  const loader = useCallback(() => residentService.getReview(complaint.id), [complaint.id]);
  const { data, loading, error, reload } = useResidentResource(loader);
  const [values, setValues] = useState({ speedRating: "", qualityRating: "", communicationRating: "", feedback: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const lock = useRef(false);
  const { showToast } = useToast();
  const canReview = complaint.status === "RESOLVED" && Boolean(complaint.resolutionVerification) && complaint.residentId === user?.id && !data && !submitted;

  async function submit(event) {
    event.preventDefault();
    if (!canReview || lock.current) return;
    const payload = Object.fromEntries(ratings.map(([key]) => [key, Number(values[key])]));
    if (Object.values(payload).some((value) => !Number.isInteger(value) || value < 1 || value > 5)) {
      setFormError("Choose a rating from 1 to 5 for each category.");
      return;
    }
    if (values.feedback.trim()) payload.feedback = values.feedback.trim();
    setFormError("");
    lock.current = true;
    setSubmitting(true);
    try {
      await residentService.submitReview(complaint.id, payload);
      setSubmitted(true);
      showToast({ type: "success", message: "Thank you. Your review was submitted." });
      await reload();
      await onReviewed();
    } catch (failure) {
      setFormError(failure.message);
      showToast({ type: "error", message: failure.message });
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  }

  return <Card title="Service review">
    {loading ? <LoadingState message="Loading review..." /> : error ? <ErrorState message={error.message} onRetry={reload} /> : data ? <>
      <dl className="resident-facts">
        <div><dt>Overall rating</dt><dd><RatingStars value={data.rating} /></dd></div>
        {ratings.map(([key, name]) => <div key={key}><dt>{name}</dt><dd><RatingStars value={data[key]} /></dd></div>)}
        <div><dt>Submitted</dt><dd>{dateTime(data.createdAt)}</dd></div>
      </dl>
      {data.feedback && <p className="resident-prose">{data.feedback}</p>}
    </> : canReview ? <form className="resident-stack" onSubmit={submit} noValidate>
      <p>Your resolution has been verified. Rate each category from 1 (poor) to 5 (excellent). You can submit one review.</p>
      {formError && <ErrorState title="Unable to submit review" message={formError} />}
      <div className="resident-grid">{ratings.map(([key, name]) => <StarRatingInput key={key} name={key} label={name} required disabled={submitting} value={values[key]} onChange={(rating) => setValues((current) => ({ ...current, [key]: rating }))} />)}</div>
      <Textarea label="Feedback (optional)" maxLength={2000} rows={4} disabled={submitting} value={values.feedback} onChange={(event) => setValues((current) => ({ ...current, feedback: event.target.value }))} />
      <div><Button type="submit" loading={submitting} loadingLabel="Submitting review...">Submit review</Button></div>
    </form> : <EmptyState title={submitted ? "Review submitted" : "No review yet"} message={submitted ? "Refresh to view your review." : "Reviews become available after the responsible authority verifies resolution."} />}
  </Card>;
}
