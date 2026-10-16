import { useState } from "react";
import { useAuth } from "../../../auth/useAuth.js";
import { ROLES } from "../../../constants/roles.js";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  Select,
} from "../../../components/ui/index.js";
import {
  DataTable,
  PageHeader,
} from "../../../components/data-display/index.js";
import { useAsyncResource } from "../../../hooks/useAsyncResource.js";
import { amenityService, dateTime, money } from "../services/amenityService.js";
import { useAmenityMutation } from "../components/useAmenityMutation.js";
import { ReservationForm } from "../components/ReservationForm.jsx";
import "../../../styles/amenities.css";
export function BookingsPage() {
  const { user } = useAuth();
  const admin = user?.role === ROLES.COMMUNITY_ADMIN;
  const resource = useAsyncResource(amenityService.bookings);
  const amenities = useAsyncResource(amenityService.list);
  const mutation = useAmenityMutation();
  const [filter, setFilter] = useState("ALL");
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState(null);
  const [changeDialog, setChangeDialog] = useState(null);
  const [changeBusy, setChangeBusy] = useState(false);
  const open = (booking, action, changeId) => {
    mutation.clearError();
    setReason("");
    setDialog({ booking, action, changeId });
  };
  return (
    <div className="amenity-stack">
      <PageHeader
        title={admin ? "Amenity bookings" : "My amenity bookings"}
        description={
          admin
            ? "Review approvals and manage community reservations."
            : "Your reservations, status changes, and booking history."
        }
        actions={
          <Button
            variant="secondary"
            disabled={resource.loading}
            onClick={resource.reload}
          >
            Refresh
          </Button>
        }
      />
      <Select
        label="Booking status"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        {["ALL", "PENDING_APPROVAL", "APPROVED", "CANCELLED", "REJECTED"].map(
          (s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ),
        )}
      </Select>
      <Card>
        <p>
          Fees and deposits are tracked separately for each booking. Online
          payment is unavailable; pending charges do not indicate payment
          received. Cancellation is available before the reservation starts.
        </p>
      </Card>
      {amenities.error && (
        <ErrorState
          message={amenities.error.message}
          onRetry={amenities.reload}
        />
      )}
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState
          message={resource.error.message}
          onRetry={resource.reload}
        />
      ) : (
        <Card title="Booking history" flush>
          <DataTable
            rows={(resource.data || []).filter(
              (b) => filter === "ALL" || b.status === filter,
            )}
            emptyTitle="No bookings found"
            columns={[
              { key: "amenityName", header: "Amenity" },
              {
                key: "startsAt",
                header: "Reservation (device time)",
                render: (_, b) => (
                  <>
                    {dateTime(b.startsAt)}
                    <br />
                    to {dateTime(b.endsAt)}
                    <br />
                    {b.attendees} people
                  </>
                ),
              },
              ...(admin
                ? [
                    {
                      key: "residentId",
                      header: "Resident / apartment",
                      render: (_, b) => (
                        <>
                          {b.residentId}
                          <br />
                          {b.apartmentId}
                        </>
                      ),
                    },
                  ]
                : []),
              {
                key: "status",
                header: "Status",
                render: (v, b) => (
                  <div className="amenity-stack">
                    <Badge
                      variant={
                        v === "APPROVED"
                          ? "success"
                          : v === "PENDING_APPROVAL"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {v.replaceAll("_", " ")}
                    </Badge>
                    {b.changes?.some(
                      (c) => c.status === "PENDING_APPROVAL",
                    ) && (
                      <Badge variant="warning">Change pending approval</Badge>
                    )}
                  </div>
                ),
              },
              {
                key: "paymentStatus",
                header: "Charges",
                render: (_, b) => (
                  <>
                    Original fee {money(b.feeMinor)}
                    <br />
                    Refundable deposit {money(b.depositMinor)}
                    {(b.extensionCharges || []).map((charge, index) => (
                      <div key={charge.id}>
                        Extension {index + 1}: {money(charge.amountMinor)} —{" "}
                        {charge.paymentStatus.replaceAll("_", " ")}
                      </div>
                    ))}
                    <br />
                    {b.paymentStatus.replaceAll("_", " ")}
                  </>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                render: (_, b) => (
                  <div className="amenity-actions">
                    <Button variant="secondary" onClick={() => setDetail(b)}>
                      History
                    </Button>
                    {!admin &&
                      !b.changes?.some(
                        (c) => c.status === "PENDING_APPROVAL",
                      ) &&
                      amenities.data?.find((a) => a.id === b.amenityId) && (
                        <>
                          {["APPROVED", "PENDING_APPROVAL"].includes(
                            b.status,
                          ) &&
                            Date.parse(b.startsAt) - Date.now() >
                              (amenities.data.find((a) => a.id === b.amenityId)
                                ?.cancellationCutoffMinutes ?? 0) *
                                60000 && (
                              <Button
                                variant="secondary"
                                onClick={() =>
                                  setChangeDialog({ booking: b, kind: "EDIT" })
                                }
                              >
                                Change time
                              </Button>
                            )}
                          {b.status === "APPROVED" &&
                            Date.parse(b.endsAt) > Date.now() &&
                            amenities.data.find((a) => a.id === b.amenityId)
                              ?.allowExtensions && (
                              <Button
                                onClick={() =>
                                  setChangeDialog({
                                    booking: b,
                                    kind: "EXTEND",
                                  })
                                }
                              >
                                Extend
                              </Button>
                            )}
                        </>
                      )}
                    {admin &&
                      b.changes
                        ?.filter((c) => c.status === "PENDING_APPROVAL")
                        .map((c) => (
                          <div key={c.id} className="amenity-actions">
                            <span>
                              {c.kind}: {dateTime(c.startsAt)} to{" "}
                              {dateTime(c.endsAt)} — estimated additional fee{" "}
                              {money(c.extensionFeeMinor)}; deposit unchanged
                            </span>
                            <Button onClick={() => open(b, "approve", c.id)}>
                              Approve change
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => open(b, "reject", c.id)}
                            >
                              Reject change
                            </Button>
                          </div>
                        ))}
                    {["APPROVED", "PENDING_APPROVAL"].includes(b.status) &&
                      Date.parse(b.startsAt) > Date.now() && (
                        <>
                          {admin && b.status === "PENDING_APPROVAL" && (
                            <>
                              <Button onClick={() => open(b, "approve")}>
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                onClick={() => open(b, "reject")}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          <Button
                            variant="danger"
                            disabled={
                              Date.parse(b.startsAt) - Date.now() <=
                              (amenities.data?.find((a) => a.id === b.amenityId)
                                ?.cancellationCutoffMinutes ?? 0) *
                                60000
                            }
                            onClick={() => open(b, "cancel")}
                          >
                            Cancel booking
                          </Button>
                        </>
                      )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      )}
      <Modal
        isOpen={Boolean(changeDialog)}
        title={
          changeDialog?.kind === "EXTEND"
            ? "Extend reservation"
            : "Change reservation time"
        }
        closeOnOverlay={false}
        onClose={changeBusy ? undefined : () => setChangeDialog(null)}
      >
        {changeDialog && (
          <ReservationForm
            onBusyChange={setChangeBusy}
            key={`${changeDialog.booking.id}-${changeDialog.kind}`}
            amenity={amenities.data.find(
              (a) => a.id === changeDialog.booking.amenityId,
            )}
            booking={changeDialog.booking}
            kind={changeDialog.kind}
            onBooked={async () => {
              setChangeDialog(null);
              await resource.reload();
            }}
          />
        )}
      </Modal>
      <Modal
        isOpen={Boolean(dialog)}
        title={`${dialog?.action || ""} booking`}
        onClose={mutation.busy ? undefined : () => setDialog(null)}
      >
        <form
          className="amenity-stack"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.run(
              () =>
                dialog.changeId
                  ? amenityService.decideChange(
                      dialog.booking.id,
                      dialog.changeId,
                      dialog.action,
                      reason,
                    )
                  : amenityService.transition(
                      dialog.booking.id,
                      dialog.action,
                      reason,
                    ),
              "Booking updated.",
              async () => {
                setDialog(null);
                await resource.reload();
              },
            );
          }}
        >
          {dialog?.changeId && (
            <p>
              Review the proposed{" "}
              {dialog.booking.changes
                .find((c) => c.id === dialog.changeId)
                ?.kind.toLowerCase()}{" "}
              while preserving the original reservation if rejected.
            </p>
          )}
          <p>
            {dialog?.booking.amenityName} •{" "}
            {dialog && dateTime(dialog.booking.startsAt)}
          </p>
          <Input
            label="Reason / review note"
            required
            maxLength={500}
            value={reason}
            disabled={mutation.busy}
            onChange={(e) => setReason(e.target.value)}
          />
          {mutation.error && <ErrorState message={mutation.error} />}
          <Button
            type="submit"
            variant={dialog?.action === "approve" ? "primary" : "danger"}
            loading={mutation.busy}
          >
            Confirm {dialog?.action}
          </Button>
        </form>
      </Modal>
      <Modal
        isOpen={Boolean(detail)}
        title="Reservation history"
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div className="amenity-stack">
            <p>Booking reference: {detail.id}</p>
            {detail.changes?.length > 0 && (
              <>
                <h3>Booking changes</h3>
                <DataTable
                  rows={detail.changes}
                  columns={[
                    { key: "kind", header: "Change" },
                    {
                      key: "startsAt",
                      header: "Proposed start",
                      render: dateTime,
                    },
                    { key: "endsAt", header: "Proposed end", render: dateTime },
                    {
                      key: "extensionFeeMinor",
                      header: "Quoted additional fee",
                      render: money,
                    },
                    { key: "status", header: "Decision" },
                    { key: "reason", header: "Reason" },
                  ]}
                />
              </>
            )}
            <DataTable
              rows={detail.history}
              rowKey={(_, i) => i}
              columns={[
                { key: "at", header: "When", render: dateTime },
                { key: "status", header: "Status" },
                { key: "reason", header: "Reason" },
              ]}
            />
            <h3>Charge history</h3>
            <p>
              Original booking fee {money(detail.feeMinor)}; refundable deposit{" "}
              {money(detail.depositMinor)}. Approval records pending charges and
              does not collect payment.
            </p>
            {detail.extensionCharges?.length > 0 && (
              <DataTable
                rows={detail.extensionCharges}
                columns={[
                  { key: "changeId", header: "Extension reference" },
                  {
                    key: "amountMinor",
                    header: "Extension fee",
                    render: money,
                  },
                  { key: "paymentStatus", header: "Payment status" },
                  { key: "createdAt", header: "Approved", render: dateTime },
                ]}
              />
            )}
            <DataTable
              rows={detail.paymentHistory}
              rowKey={(_, i) => i}
              columns={[
                { key: "at", header: "When", render: dateTime },
                { key: "status", header: "Status" },
                { key: "reason", header: "Details" },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
