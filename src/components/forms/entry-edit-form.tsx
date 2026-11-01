'use client'

import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FuelFields, readFuelForm, type FuelFormDefaults } from '@/components/forms/fuel-fields'
import { ServiceFields, readServiceForm, type ServiceFormDefaults } from '@/components/forms/service-fields'
import type { FieldErrors } from '@/components/forms/field'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { FuelGrade } from '@/lib/domain/enums'
import { entryErrorMessages, type EntryActionResult } from '@/lib/domain/entry-result'
import { deleteFuelEntryAction, updateFuelEntryAction } from '@/app/(app)/fuel/actions'
import { deleteServiceEntryAction, updateServiceEntryAction } from '@/app/(app)/service/actions'

type Vehicle = { id: string; name: string; defaultGrade: FuelGrade }

type Props = { id: string; vehicles: Vehicle[] } & (
  | { kind: 'fuel'; defaultValues: FuelFormDefaults }
  | { kind: 'service'; defaultValues: ServiceFormDefaults }
)

export function EntryEditForm(props: Props) {
  const { id, vehicles } = props
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function handle(res: EntryActionResult | undefined) {
    // success redirects, so we only get here on failure
    if (!res || res.ok) return
    setErrors(entryErrorMessages(res))
    setFormError(res.error === 'NOT_FOUND' ? 'Entry not found' : null)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    start(async () => {
      try {
        handle(
          props.kind === 'fuel'
            ? await updateFuelEntryAction(id, readFuelForm(f))
            : await updateServiceEntryAction(id, readServiceForm(f)),
        )
      } catch (err) {
        if (isRedirectError(err)) throw err
        toast.error('Couldn\'t save — check your connection')
      }
    })
  }

  function onDelete() {
    start(async () => {
      try {
        handle(props.kind === 'fuel' ? await deleteFuelEntryAction(id) : await deleteServiceEntryAction(id))
      } catch (err) {
        if (isRedirectError(err)) throw err
        toast.error('Couldn\'t delete — check your connection')
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {props.kind === 'fuel' ? (
          <FuelFields vehicles={vehicles} defaultValues={props.defaultValues} errors={errors} lockVehicle />
        ) : (
          <ServiceFields vehicles={vehicles} defaultValues={props.defaultValues} errors={errors} lockVehicle />
        )}
        {formError && <p className="text-sm text-destructive">{formError}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </form>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" disabled={pending} />}>
          Delete entry
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
