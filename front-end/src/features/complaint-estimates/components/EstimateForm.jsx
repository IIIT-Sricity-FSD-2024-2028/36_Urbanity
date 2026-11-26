import { useId, useRef, useState } from "react";
import { useAuth } from "../../../auth/useAuth.js";
import { Button, Input, Select, Textarea, useToast } from "../../../components/ui/index.js";
import { ROLES } from "../../../constants/roles.js";
import { categories, costLine, estimateTotal, formatEstimateAmount, validateEstimate } from "../estimateModel.js";
import { useChangeComplaintEstimateMutation } from "../services/complaintEstimatesApi.js";

const emptyLine = (key, category = "MATERIAL") => ({ key, category, description: "", quantity: "1", unitPrice: "" });

export function EstimateForm({ id, estimate, previousEstimateId, refreshing }) {
  const { sessionRevision } = useAuth();
  const { showToast } = useToast();
  const errorId = useId();
  const nextKey = useRef(estimate?.costs.length || 2);
  const submitting = useRef(false);
  const [submit, { isLoading }] = useChangeComplaintEstimateMutation();
  const [error, setError] = useState("");
  const [details, setDetails] = useState({
    inspection: estimate?.inspection || "",
    proposedResolution: estimate?.proposedResolution || "",
    completionHours: estimate?.completionHours ?? "",
    notes: estimate?.notes || "",
  });
  const [lines, setLines] = useState(() => estimate ? estimate.costs.map((entry, key) => ({
    key, category: entry.category, description: entry.description, quantity: String(entry.quantity),
    unitPrice: (entry.unitPricePaise / 100).toFixed(2),
  })) : [emptyLine(0), emptyLine(1, "LABOUR")]);
  const costs = lines.map(costLine);
  const total = estimateTotal(costs);
  const changeDetail = (field) => (event) => setDetails({ ...details, [field]: event.target.value });
  const changeLine = (key, field) => (event) => {
    const value = event.target.value;
    setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: value } : line));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current || refreshing) return;
    const result = validateEstimate(details, costs);
    if (typeof result === "string") {
      setError(result);
      return;
    }
    submitting.current = true;
    setError("");
    try {
      const payload = { ...result, ...(previousEstimateId ? { previousEstimateId } : {}) };
      await submit({ id, payload, sessionRevision, role: ROLES.MAINTENANCE_WORKER, operation: "submit" }).unwrap();
      showToast({ type: "success", message: "Estimate submitted for tower verification." });
    } catch (requestError) {
      setError(requestError.message);
      showToast({ type: "error", message: requestError.message });
    } finally {
      submitting.current = false;
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-describedby={error ? errorId : undefined}>
      <fieldset className="estimate-form" disabled={isLoading}>
        <legend>{estimate ? "Revise estimate" : "Site inspection and estimate"}</legend>
        <Textarea label="Inspection details" rows={3} required minLength={10} maxLength={2000} value={details.inspection} onChange={changeDetail("inspection")} />
        <Textarea label="Proposed resolution" rows={3} required minLength={10} maxLength={2000} value={details.proposedResolution} onChange={changeDetail("proposedResolution")} />
        <Input label="Estimated completion time (hours)" type="number" required min={1} max={8760} value={details.completionHours} onChange={changeDetail("completionHours")} />
        <Textarea label="Supporting notes" rows={2} required maxLength={2000} value={details.notes} onChange={changeDetail("notes")} />
        {lines.map((line, index) => (
          <fieldset key={line.key} className="estimate-cost">
            <legend>Cost item {index + 1}</legend>
            <div className="estimate-cost__inputs">
              <Select label="Category" value={line.category} onChange={changeLine(line.key, "category")}>
                {Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </Select>
              <Input label="Description" required maxLength={200} value={line.description} onChange={changeLine(line.key, "description")} />
              <Input label="Quantity" type="number" required min={1} max={10_000} value={line.quantity} onChange={changeLine(line.key, "quantity")} />
              <Input label="Unit price (₹)" inputMode="decimal" required value={line.unitPrice} onChange={changeLine(line.key, "unitPrice")} />
            </div>
            <div className="estimate-actions">
              <span>Subtotal {costs[index] ? formatEstimateAmount(estimateTotal([costs[index]])) : "—"}</span>
              <Button variant="secondary" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter(({ key }) => key !== line.key))}>
                Remove item {index + 1}
              </Button>
            </div>
          </fieldset>
        ))}
        <div className="estimate-actions">
          <Button variant="secondary" disabled={lines.length === 30} onClick={() => {
            const line = emptyLine(nextKey.current++, "ADDITIONAL");
            setLines((current) => [...current, line]);
          }}>Add cost item</Button>
          <strong aria-live="polite">Estimated total {total === null ? "—" : formatEstimateAmount(total)}</strong>
        </div>
        {error && <p id={errorId} role="alert" className="ui-field__error">{error}</p>}
        <div><Button type="submit" loading={isLoading} disabled={refreshing}>{estimate ? "Submit revision" : "Submit estimate"}</Button></div>
      </fieldset>
    </form>
  );
}
