import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth.js";
import { ROLES } from "../../../constants/roles.js";
import { ROUTES } from "../../../constants/routes.js";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
} from "../../../components/ui/index.js";
import { PageHeader } from "../../../components/data-display/index.js";
import { useAsyncResource } from "../../../hooks/useAsyncResource.js";
import { amenityService, money } from "../services/amenityService.js";
import { AmenityForm } from "../components/AmenityForm.jsx";
import { ReservationForm } from "../components/ReservationForm.jsx";
import { MaintenanceBlocks } from "../components/MaintenanceBlocks.jsx";
import { useAmenityMutation } from "../components/useAmenityMutation.js";
import "../../../styles/amenities.css";
export function AmenitiesPage() {
  const { user } = useAuth();
  const admin = user?.role === ROLES.COMMUNITY_ADMIN;
  const resource = useAsyncResource(amenityService.list);
  const mutation = useAmenityMutation();
  const [dialog, setDialog] = useState(null);
  const [reservationBusy, setReservationBusy] = useState(false);
  const open = (type, amenity) => {
    mutation.clearError();
    setDialog({ type, amenity });
  };
  return (
    <div
      className={`amenity-stack amenity-page${dialog?.type === "edit" ? " amenity-page--editing" : ""}`}
    >
      <PageHeader
        title={admin ? "Manage amenities" : "Community amenities"}
        description={
          admin
            ? "Configure facilities, booking rules, and maintenance availability."
            : "Browse facilities and reserve a time in your community."
        }
        actions={
          <div className="amenity-actions">
            <Link
              className="ui-button ui-button--secondary"
              to={
                admin
                  ? ROUTES.COMMUNITY_ADMIN_BOOKINGS
                  : ROUTES.RESIDENT_BOOKINGS
              }
            >
              {admin ? "Review bookings" : "My bookings"}
            </Link>
            {admin && (
              <Button onClick={() => open("edit", null)}>Create amenity</Button>
            )}
          </div>
        }
      />
      {resource.loading ? (
        <LoadingState message="Loading amenities..." />
      ) : resource.error ? (
        <ErrorState
          message={resource.error.message}
          onRetry={resource.reload}
        />
      ) : !resource.data?.length ? (
        <EmptyState
          title="No amenities yet"
          message={
            admin
              ? "Create your first community facility."
              : "Your community has not added any amenities yet."
          }
        />
      ) : (
        <div className="amenity-grid">
          {resource.data.map((a) => (
            <Card
              key={a.id}
              title={a.name}
              actions={
                <Badge variant={a.status === "ACTIVE" ? "success" : "neutral"}>
                  {a.status}
                </Badge>
              }
            >
              <div className="amenity-stack">
                <p>{a.description || "No description provided."}</p>
                <p>
                  {a.weekdays
                    .map(
                      (d) =>
                        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d],
                    )
                    .join(", ")}{" "}
                  • {a.opensAt}–{a.closesAt} ({a.timeZone})
                </p>
                <p>
                  Capacity: {a.capacity} •{" "}
                  {a.exclusive ? "Exclusive reservation" : "Shared capacity"}
                  <br />
                  Duration: {a.minDurationMinutes}–{a.maxDurationMinutes}{" "}
                  minutes
                  <br />
                  Up to {a.maxActiveBookings} active bookings per resident •
                  Book at least {a.advanceDays} days before
                  <br />
                  {a.requiresApproval
                    ? "Approval required"
                    : "Automatic approval"}
                </p>
                <p>
                  Fee: {money(a.feeMinor)} • Deposit: {money(a.depositMinor)}
                </p>
                <div className="amenity-actions">
                  {admin ? (
                    <Button onClick={() => open("edit", a)}>
                      Edit amenity
                    </Button>
                  ) : (
                    <Button
                      disabled={a.status !== "ACTIVE"}
                      onClick={() => open("reserve", a)}
                    >
                      Check & reserve
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => open("blocks", a)}>
                    Maintenance availability
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal
        isOpen={Boolean(dialog)}
        size={dialog?.type === "edit" ? "lg" : "md"}
        closeOnOverlay={dialog?.type !== "edit"}
        footer={
          dialog?.type === "edit" ? (
            <>
              <Button
                variant="secondary"
                disabled={mutation.busy}
                onClick={() => setDialog(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="amenity-form"
                loading={mutation.busy}
                loadingLabel="Saving..."
              >
                {dialog.amenity ? "Save changes" : "Create amenity"}
              </Button>
            </>
          ) : undefined
        }
        title={
          dialog?.type === "edit"
            ? dialog.amenity
              ? "Edit amenity"
              : "Create amenity"
            : `${dialog?.type === "reserve" ? "Reserve" : "Maintenance"} — ${dialog?.amenity?.name || ""}`
        }
        onClose={
          mutation.busy || reservationBusy ? undefined : () => setDialog(null)
        }
      >
        {mutation.error && <ErrorState message={mutation.error} />}
        {dialog?.type === "edit" && (
          <AmenityForm
            key={dialog.amenity?.id || "new"}
            amenity={dialog.amenity}
            busy={mutation.busy}
            onSave={(values) =>
              mutation.run(
                () => amenityService.save(dialog.amenity?.id, values),
                "Amenity saved.",
                async () => {
                  setDialog(null);
                  await resource.reload();
                },
              )
            }
          />
        )}
        {dialog?.type === "reserve" && (
          <ReservationForm
            onBusyChange={setReservationBusy}
            amenity={dialog.amenity}
            onBooked={async () => {
              setDialog(null);
              await resource.reload();
            }}
          />
        )}
        {dialog?.type === "blocks" && (
          <MaintenanceBlocks amenity={dialog.amenity} admin={admin} />
        )}
      </Modal>
    </div>
  );
}
