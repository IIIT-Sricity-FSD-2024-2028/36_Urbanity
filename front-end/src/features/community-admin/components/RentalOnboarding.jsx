import { useRef, useState } from "react";
import {
  Button,
  ErrorState,
  Input,
  Select,
  useToast,
} from "../../../components/ui/index.js";
import { communityAdminService } from "../services/communityAdminService.js";
import { tenantOnboardingPayload } from "../rentalForms.js";

export function RentalOnboarding({ apartments, listings, residents, onSaved }) {
  const [form, setForm] = useState({
    listingId: "",
    existingTenantId: "",
    mode: "EXISTING",
    name: "",
    email: "",
    password: "",
    startDate: "",
    endDate: "",
    dueDay: "1",
  });
  const [review, setReview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const retry = useRef(null),
    lock = useRef(false);
  const { showToast } = useToast();
  const apartmentLabel = (id) =>
    apartments.find((item) => item.id === id)?.label || id;
  const field = (key) => ({
    value: form[key],
    disabled: busy,
    onChange: (event) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });
  const listing = listings.find(
    (item) => item.id === (review?.listingId || form.listingId),
  );
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const fingerprint = JSON.stringify(review);
      if (retry.current?.fingerprint !== fingerprint)
        retry.current = { fingerprint, id: crypto.randomUUID() };
      await communityAdminService.onboardRentalTenant({
        ...review,
        clientRequestId: retry.current.id,
      });
      showToast({
        type: "success",
        message: "Lease proposal created. Awaiting tenant acceptance.",
      });
      await onSaved();
    } catch (failure) {
      setError(failure.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="ca-stack">
      {!review ? (
        <form
          className="ca-form ca-form--grid"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              setReview(tenantOnboardingPayload(form));
              setError("");
            } catch (failure) {
              setError(failure.message);
            }
          }}
        >
          <Select label="Available listing" required {...field("listingId")}>
            <option value="">Select listing</option>
            {listings
              .filter(
                (item) =>
                  item.arrangement === "COMMUNITY" &&
                  item.status === "AVAILABLE",
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {apartmentLabel(item.apartmentId)}
                </option>
              ))}
          </Select>
          <Select label="Account" {...field("mode")}>
            <option value="EXISTING">Reuse existing resident</option>
            <option value="NEW">Create resident account</option>
          </Select>
          {form.mode === "EXISTING" ? (
            <Select label="Resident" required {...field("existingTenantId")}>
              <option value="">Select resident</option>
              {residents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.email})
                </option>
              ))}
            </Select>
          ) : (
            <>
              <Input label="Name" required maxLength={100} {...field("name")} />
              <Input
                label="Email"
                type="email"
                required
                maxLength={100}
                {...field("email")}
              />
              <Input
                label="Initial password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                {...field("password")}
              />
            </>
          )}
          <Input
            label="Lease start"
            type="date"
            required
            min={listing?.availableFrom}
            {...field("startDate")}
          />
          <Input
            label="Lease end"
            type="date"
            required
            min={form.startDate || listing?.availableFrom}
            max={listing?.availableUntil}
            {...field("endDate")}
          />
          <Input
            label="Due day"
            type="number"
            min="1"
            max="31"
            required
            {...field("dueDay")}
          />
          <div className="ca-actions ca-rentals__wide">
            <Button type="submit">Review lease</Button>
          </div>
        </form>
      ) : (
        <>
          <dl className="ca-details">
            <div>
              <dt>Apartment</dt>
              <dd>{apartmentLabel(listing?.apartmentId)}</dd>
            </div>
            <div>
              <dt>Tenant</dt>
              <dd>
                {review.account
                  ? `${review.account.name} (${review.account.email})`
                  : residents.find(
                      (item) => item.id === review.existingTenantId,
                    )?.name}
              </dd>
            </div>
            <div>
              <dt>Lease dates</dt>
              <dd>
                {review.startDate} &ndash; {review.endDate}
              </dd>
            </div>
            <div>
              <dt>Monthly due day</dt>
              <dd>{review.dueDay}</dd>
            </div>
            <div>
              <dt>Monthly rent (INR)</dt>
              <dd>{listing?.monthlyRent}</dd>
            </div>
            <div>
              <dt>Refundable deposit (INR)</dt>
              <dd>{listing?.securityDeposit}</dd>
            </div>
          </dl>
          <p className="ca-muted">
            Creates an admin-approved proposal. The tenant must accept before
            activation. No payment is collected.
          </p>
          <div className="ca-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Back
            </Button>
            <Button loading={busy} onClick={save}>
              Create lease proposal
            </Button>
          </div>
        </>
      )}
      {error && <ErrorState message={error} />}
    </div>
  );
}
