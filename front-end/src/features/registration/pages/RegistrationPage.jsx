import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Textarea,
} from "../../../components/ui/index.js";
import { ROUTES } from "../../../constants/routes.js";
import { useAsyncResource } from "../../../hooks/useAsyncResource.js";
import { registrationService as service } from "../services/registrationService.js";
import {
  applicationPayload,
  money,
  phonePattern,
} from "../registrationModel.mjs";
import "../registration.css";

const initial = {
  fullName: "",
  email: "",
  phone: "",
  communityName: "",
  description: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  towers: "",
  floors: "",
  apartments: "",
  notes: "",
  authorized: false,
};
const steps = [
  "Representative",
  "Community",
  "Proposed size",
  "Review & submit",
];

export function RegistrationPage() {
  const navigate = useNavigate();
  const pricing = useAsyncResource(
    useCallback((signal) => service.pricing(signal), []),
  );
  const [form, setForm] = useState(initial),
    [step, setStep] = useState(0),
    [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const lock = useRef(false),
    requestId = useRef(crypto.randomUUID());
  const field = (name, label, props = {}) => (
    <Input
      label={label}
      required
      name={name}
      value={form[name]}
      onChange={(e) => {
        setForm((f) => ({ ...f, [name]: e.target.value }));
        setQuote(null);
      }}
      {...props}
    />
  );
  async function submit(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (step < 2) setStep(step + 1);
      else if (step === 2) {
        const payload = applicationPayload(
          form,
          requestId.current,
          pricing.data.version,
        );
        setQuote(
          await service.quote({
            towers: payload.towers,
            apartments: payload.apartments,
          }),
        );
        setStep(3);
      } else {
        const application = await service.submit(
          applicationPayload(form, requestId.current, quote.version),
        );
        navigate(`${ROUTES.REGISTER}/${application.id}`, { replace: true });
      }
    } catch (err) {
      setError(err);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="registration-page">
      <nav className="registration-nav">
        <Link to={ROUTES.HOME}>URBANITY</Link>
        <Link to={ROUTES.LOGIN}>Login</Link>
      </nav>
      <h1>Register Your Community</h1>
      <p>
        Apply as an authorized community representative. Approval, recorded mock
        payment and account setup are required before access.
      </p>
      {pricing.loading ? (
        <LoadingState />
      ) : pricing.error ? (
        <ErrorState message={pricing.error.message} onRetry={pricing.reload} />
      ) : !pricing.data?.enabled ? (
        <EmptyState
          title="Registration is temporarily closed"
          message="The platform administrator has paused applications. Please check back later."
        />
      ) : (
        <Card title={steps[step]}>
          <ol className="registration-steps" aria-label="Registration progress">
            {steps.map((label, i) => (
              <li key={label} aria-current={step === i ? "step" : undefined}>
                {i + 1}. {label}
              </li>
            ))}
          </ol>
          {error && <ErrorState message={error.message} />}
          <form onSubmit={submit}>
            <fieldset disabled={busy} className="registration-fields">
              {step === 0 && (
                <>
                  <div className="registration-grid">
                    {field("fullName", "Full name", {
                      autoComplete: "name",
                      minLength: 2,
                      maxLength: 100,
                    })}
                    {field("email", "Email", {
                      type: "email",
                      autoComplete: "email",
                      maxLength: 100,
                    })}
                    {field("phone", "Phone", {
                      required: false,
                      type: "tel",
                      autoComplete: "tel",
                      pattern: phonePattern.source,
                      maxLength: 20,
                    })}
                  </div>
                  <label className="registration-check">
                    <input
                      type="checkbox"
                      required
                      checked={form.authorized}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, authorized: e.target.checked }))
                      }
                    />
                    I am authorized to represent this community and request its
                    onboarding.
                  </label>
                </>
              )}
              {step === 1 && (
                <>
                  <div className="registration-grid">
                    {field("communityName", "Community name", {
                      minLength: 2,
                      maxLength: 120,
                    })}
                    {field("address", "Street address", {
                      minLength: 5,
                      maxLength: 150,
                      autoComplete: "street-address",
                    })}
                    {field("city", "City", { minLength: 2, maxLength: 50 })}
                    {field("state", "State", { minLength: 2, maxLength: 50 })}
                    {field("postalCode", "Postal code", {
                      pattern: "[A-Za-z0-9 -]{3,12}",
                      maxLength: 12,
                    })}
                    {field("country", "Country", {
                      minLength: 2,
                      maxLength: 50,
                    })}
                  </div>
                  <Textarea
                    label="Description (optional)"
                    maxLength={500}
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                </>
              )}
              {step === 2 && (
                <>
                  <p>
                    Proposed totals only. Your admin will configure actual
                    towers, floors and apartments after activation.
                  </p>
                  <div className="registration-grid">
                    {field("towers", "Number of towers", {
                      type: "number",
                      min: 1,
                      max: 10000,
                      step: 1,
                    })}
                    {field(
                      "floors",
                      "Approximate total floors across all towers",
                      { type: "number", min: 1, max: 1000000, step: 1 },
                    )}
                    {field("apartments", "Approximate total apartments", {
                      type: "number",
                      min: 1,
                      max: 1000000,
                      step: 1,
                    })}
                  </div>
                  <Textarea
                    label="Additional information (optional)"
                    maxLength={1000}
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                  />
                </>
              )}
              {step === 3 && quote && (
                <>
                  <dl className="registration-facts">
                    <div>
                      <dt>Representative</dt>
                      <dd>
                        {form.fullName} ({form.email})
                      </dd>
                    </div>
                    <div>
                      <dt>Community</dt>
                      <dd>
                        {form.communityName}
                        <br />
                        {form.address}, {form.city}, {form.state},{" "}
                        {form.postalCode}, {form.country}
                      </dd>
                    </div>
                    <div>
                      <dt>Proposed size</dt>
                      <dd>
                        {form.towers} towers / {form.floors} floors /{" "}
                        {form.apartments} apartments
                      </dd>
                    </div>
                    <div>
                      <dt>Total platform fee</dt>
                      <dd>{money(quote.totalMinor)}</dd>
                    </div>
                    <div>
                      <dt>Initial payment due</dt>
                      <dd>{money(quote.initialMinor)}</dd>
                    </div>
                    <div>
                      <dt>Balance after initial mock payment</dt>
                      <dd>{money(quote.totalMinor - quote.initialMinor)}</dd>
                    </div>
                  </dl>
                  <p>
                    Fee uses the existing platform plan:{" "}
                    {money(quote.towerRate * 100)} per tower +{" "}
                    {money(quote.apartmentRate * 100)} per apartment. Initial
                    payment: {quote.initialPercent}% (rounded up to whole INR).
                  </p>
                  <p>
                    Submit first, then use Pay Initial Amount on your
                    confirmation page. Mock payments are for evaluation only; no
                    real money is transferred. Super Admin approval is still
                    required.
                  </p>
                  <p>
                    Save your reference and return in this browser within 30
                    days. No email or credentials are sent automatically.
                  </p>
                </>
              )}
            </fieldset>
            <div className="registration-actions">
              {step > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setStep(step - 1);
                    setError(null);
                  }}
                >
                  Back
                </Button>
              )}
              <Button type="submit" loading={busy}>
                {step === 3
                  ? "Submit Registration Request"
                  : step === 2
                    ? "Review fee & application"
                    : "Continue"}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </main>
  );
}
