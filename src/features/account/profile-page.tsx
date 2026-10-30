import { zodResolver } from '@hookform/resolvers/zod'
import { ImageIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { MAX_AVATAR_BYTES, newPasswordSchema, type Profile, updateProfileSchema } from '@/api/contracts'
import { Field, FormAlert, PasswordInput } from '@/components/form-field'
import { ErrorState, errorMessage } from '@/components/states'
import { Button } from '@/components/ui/button'
import { inputClasses } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { applyApiErrors } from '@/lib/form-errors'
import { cn } from '@/lib/utils'
import { useChangePassword, useProfile, useRemoveAvatar, useUpdateAvatar, useUpdateProfile } from './queries'

/** Profile data + optional password change, saved with a single "Salvar" as in the layout. */
const profileFormSchema = updateProfileSchema
  .extend({
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    const changing = Boolean(v.currentPassword || v.newPassword || v.confirmPassword)
    if (!changing) return
    if (!v.currentPassword) ctx.addIssue({ code: 'custom', path: ['currentPassword'], message: 'Informe a senha atual' })
    const strength = newPasswordSchema.safeParse(v.newPassword)
    if (!strength.success) ctx.addIssue({ code: 'custom', path: ['newPassword'], message: strength.error.issues[0]!.message })
    else if (v.newPassword === v.currentPassword)
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'A nova senha deve ser diferente da atual' })
    if (v.confirmPassword !== v.newPassword)
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'As senhas não conferem' })
  })
type ProfileForm = z.infer<typeof profileFormSchema>

const PROFILE_FIELDS = ['displayName', 'username', 'email', 'ensName', 'walletNickname'] as const
const PASSWORD_FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const

function AvatarField({ profile }: { profile: Profile }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const update = useUpdateAvatar()
  const remove = useRemoveAvatar()

  const onFile = (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Envie uma imagem PNG, JPG ou WebP.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('A imagem deve ter no máximo 512 KB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () =>
      update.mutate(String(reader.result), {
        onSuccess: () => toast.success('Avatar atualizado', { id: 'avatar' }),
        onError: (e) => setError(errorMessage(e)),
      })
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[15px]" id="avatar-label">
        Avatar
      </span>
      <div className="flex items-center gap-6">
        <span className="flex size-[50px] items-center justify-center overflow-hidden rounded-full border border-border-soft bg-surface-raised">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="Seu avatar atual" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-6 text-sand" aria-label="Sem avatar" />
          )}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <Button type="button" onClick={() => fileRef.current?.click()} disabled={update.isPending} aria-describedby="avatar-label">
          {update.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        {profile.avatarUrl && (
          <button
            type="button"
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => toast.success('Avatar removido', { id: 'avatar' }),
                onError: (e) => setError(errorMessage(e)),
              })
            }
            disabled={remove.isPending}
            className="text-[15px] hover:text-apricot"
          >
            Remover
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function ProfileForm({ profile }: { profile: Profile }) {
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const [formError, setFormError] = useState<string | null>(null)
  const { register, handleSubmit, setError, reset, formState } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: profile.displayName,
      username: profile.username,
      email: profile.email,
      ensName: profile.ensName,
      walletNickname: profile.walletNickname,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })
  const { errors, dirtyFields } = formState

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const profileDirty = PROFILE_FIELDS.some((f) => dirtyFields[f])
    const changingPassword = Boolean(values.currentPassword)
    if (!profileDirty && !changingPassword) {
      toast.info('Nenhuma alteração para salvar', { id: 'profile' })
      return
    }
    try {
      if (profileDirty) {
        const { currentPassword: _c, newPassword: _n, confirmPassword: _cf, ...data } = values
        await updateProfile.mutateAsync(data)
      }
    } catch (error) {
      setFormError(applyApiErrors(error, setError, PROFILE_FIELDS))
      return
    }
    try {
      if (changingPassword) {
        await changePassword.mutateAsync({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
          confirmPassword: values.confirmPassword,
        })
      }
    } catch (error) {
      setFormError(applyApiErrors(error, setError, PASSWORD_FIELDS))
      reset({ ...values }, { keepErrors: true })
      return
    }
    reset({ ...values, currentPassword: '', newPassword: '', confirmPassword: '' })
    toast.success(changingPassword ? 'Perfil e senha atualizados' : 'Perfil atualizado', { id: 'profile' })
  })

  const saving = updateProfile.isPending || changePassword.isPending
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <h1 className="text-lg font-bold">Perfil do colecionador</h1>
      <FormAlert message={formError} />
      <div className="grid gap-x-7 gap-y-5 lg:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName?.message}>
          {(a) => <input {...a} {...register('displayName')} autoComplete="name" className={inputClasses} />}
        </Field>
        <Field label="Nome de usuário" required error={errors.username?.message}>
          {(a) => <input {...a} {...register('username')} autoComplete="username" className={inputClasses} />}
        </Field>
        <Field label="E-mail" required error={errors.email?.message}>
          {(a) => <input {...a} {...register('email')} type="email" autoComplete="email" className={inputClasses} />}
        </Field>
        <Field label="Nome ENS" required error={errors.ensName?.message}>
          {(a) => (
            <div className="flex gap-2">
              <span className="inline-flex h-10 items-center rounded-sm border border-border-strong px-3 text-sm">.eth</span>
              <input {...a} {...register('ensName')} spellCheck={false} className={inputClasses} />
            </div>
          )}
        </Field>
        <Field label="Apelido da carteira" required error={errors.walletNickname?.message}>
          {(a) => <input {...a} {...register('walletNickname')} className={inputClasses} />}
        </Field>
        <AvatarField profile={profile} />
      </div>

      <fieldset className="flex max-w-[417px] flex-col gap-4">
        <legend className="mb-4 text-lg font-bold">Alterar senha</legend>
        <Field label="Senha atual" error={errors.currentPassword?.message}>
          {(a) => <PasswordInput {...a} {...register('currentPassword')} autoComplete="current-password" />}
        </Field>
        <Field label="Nova senha" error={errors.newPassword?.message} hint="Mínimo de 8 caracteres, com letras e números.">
          {(a) => <PasswordInput {...a} {...register('newPassword')} autoComplete="new-password" />}
        </Field>
        <Field label="Confirmar nova senha" error={errors.confirmPassword?.message}>
          {(a) => <PasswordInput {...a} {...register('confirmPassword')} autoComplete="new-password" />}
        </Field>
      </fieldset>

      <Button type="submit" className={cn('w-[131px]')} disabled={saving} aria-busy={saving}>
        {saving ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

export function ProfilePage() {
  const { data, isPending, error, refetch, isFetching } = useProfile()
  if (isPending) {
    return (
      <div className="grid gap-5 lg:grid-cols-2" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    )
  }
  if (!data) return <ErrorState title="Não foi possível carregar seu perfil" error={error} onRetry={() => void refetch()} retrying={isFetching} />
  return <ProfileForm key={data.id} profile={data} />
}
