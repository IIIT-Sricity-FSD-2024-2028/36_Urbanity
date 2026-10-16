import { useCallback, useState } from "react";
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Input,
  LoadingState,
} from "../../../components/ui/index.js";
import { DataTable } from "../../../components/data-display/index.js";
import { useAsyncResource } from "../../../hooks/useAsyncResource.js";
import { amenityService, dateTime } from "../services/amenityService.js";
import { useAmenityMutation } from "./useAmenityMutation.js";
export function MaintenanceBlocks({ amenity, admin }) {
  const loader = useCallback(
    (signal) => amenityService.blocks(amenity.id, signal),
    [amenity.id],
  );
  const resource = useAsyncResource(loader);
  const mutation = useAmenityMutation();
  const [release, setRelease] = useState(null);
  const [values, setValues] = useState({
    startsAt: "",
    endsAt: "",
    reason: "",
  });
  const field = (key) => ({
    value: values[key],
    disabled: mutation.busy,
    onChange: (e) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });
  return (
    <div className="amenity-stack">
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState
          message={resource.error.message}
          onRetry={resource.reload}
        />
      ) : (
        <DataTable
          rows={resource.data}
          emptyTitle="No maintenance blocks"
          columns={[
            { key: "startsAt", header: "Start", render: dateTime },
            { key: "endsAt", header: "End", render: dateTime },
            {
              key: "releasedAt",
              header: "Status",
              render: (v) => (v ? "Released" : "Blocked"),
            },
            ...(admin
              ? [
                  { key: "reason", header: "Reason" },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (_, b) =>
                      !b.releasedAt && (
                        <Button
                          variant="secondary"
                          disabled={mutation.busy}
                          onClick={() => setRelease(b)}
                        >
                          Release
                        </Button>
                      ),
                  },
                ]
              : []),
          ]}
        />
      )}
      {mutation.error && <ErrorState message={mutation.error} />}
      {admin && (
        <form
          className="amenity-stack"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.run(
              () =>
                amenityService.block(amenity.id, {
                  ...values,
                  startsAt: new Date(values.startsAt).toISOString(),
                  endsAt: new Date(values.endsAt).toISOString(),
                }),
              "Maintenance block added.",
              async () => {
                setValues({ startsAt: "", endsAt: "", reason: "" });
                await resource.reload();
              },
            );
          }}
        >
          <p>
            Block times use your device time zone. Cancel conflicting
            reservations first; blocks never silently cancel bookings.
          </p>
          <Input
            type="datetime-local"
            label="Block start"
            required
            {...field("startsAt")}
          />
          <Input
            type="datetime-local"
            label="Block end"
            required
            {...field("endsAt")}
          />
          <Input
            label="Maintenance reason"
            required
            maxLength={500}
            {...field("reason")}
          />
          <Button type="submit" loading={mutation.busy}>
            Add maintenance block
          </Button>
        </form>
      )}
      <ConfirmDialog
        isOpen={Boolean(release)}
        title="Release maintenance block"
        message="This time will become bookable again, subject to amenity rules."
        loading={mutation.busy}
        onClose={() => setRelease(null)}
        onConfirm={() =>
          mutation.run(
            () => amenityService.release(amenity.id, release.id),
            "Block released.",
            async () => {
              setRelease(null);
              await resource.reload();
            },
          )
        }
      />
    </div>
  );
}
