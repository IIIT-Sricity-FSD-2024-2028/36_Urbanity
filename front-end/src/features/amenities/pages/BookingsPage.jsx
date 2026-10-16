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
import "../../../styles/amenities.css";
export function BookingsPage() {
  const { user } = useAuth();
  const admin = user?.role === ROLES.COMMUNITY_ADMIN;
  const resource = useAsyncResource(amenityService.bookings);
  const mutation = useAmenityMutation();
  const [filter, setFilter] = useState("ALL");
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState(null);
  const open = (booking, action) => {
    mutation.clearError();
    setReason("");
    setDialog({ booking, action });
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
                render: (v) => (
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
                ),
              },
              {
                key: "paymentStatus",
                header: "Charges",
                render: (_, b) => (
                  <>
                    Fee {money(b.feeMinor)}
                    <br />
                    Deposit {money(b.depositMinor)}
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
                amenityService.transition(
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
