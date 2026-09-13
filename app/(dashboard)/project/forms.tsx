'use client';

// The Project module's forms - `project::project.create`, the team and
// workspace modals, and the share/settings panels on the project screen.

import { useActionState } from 'react';
import {
  FormAlert,
  FormInput,
  FormSelect,
  FormTextarea,
  FormActions,
  type SelectOption,
} from '@/components/erp/fields';
import { SubmitButton } from '@/components/erp/submit-button';
import {
  storeProject,
  saveProject,
  shareProjectAction,
  storeTeam,
  saveTeam,
  inviteToTeam,
  storeWorkspace,
  type ProjectFormState,
} from './actions';
import { Phrase } from '@/context/TranslationContext';

const EMPTY: ProjectFormState = {};

function Messages({ state }: { state: ProjectFormState }) {
  return (
    <>
      <FormAlert variant="error" message={state.error} />
      <FormAlert variant="success" message={state.success} />
    </>
  );
}

export function ProjectForm({
  teams,
  teamId,
}: {
  teams: SelectOption[];
  teamId?: string;
}) {
  const [state, action] = useActionState(storeProject, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <Messages state={state} />

      <FormInput
        label="Project Name"
        name="name"
        required
        error={state.fieldErrors?.name}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormSelect
          label="Team"
          name="team_id"
          defaultValue={teamId ?? ''}
          options={teams}
          placeholder="No team"
        />
        <FormSelect
          label="Privacy"
          name="privacy"
          defaultValue="1"
          options={[
            { value: '1', label: 'Public to team' },
            { value: '0', label: 'Private' },
          ]}
        />
        <FormSelect
          label="Default View"
          name="default_view"
          defaultValue="list"
          options={[
            { value: 'list', label: 'List' },
            { value: 'board', label: 'Board' },
            { value: 'files', label: 'Files' },
            { value: 'conversation', label: 'Conversation' },
          ]}
        />
      </div>

      <FormTextarea label="Description" name="description" rows={4} />

      <FormActions>
        <SubmitButton>Create Project</SubmitButton>
      </FormActions>
    </form>
  );
}

export function ProjectSettingsForm({
  project,
  members,
}: {
  project: { id: number; name: string; description: string; dueDate: string; userId: number };
  members: SelectOption[];
}) {
  const [state, action] = useActionState(saveProject, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="project_id" value={project.id} />
      <Messages state={state} />

      <FormInput label="Project Name" name="name" defaultValue={project.name} required />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormInput
          label="Due Date"
          name="due_date"
          type="date"
          defaultValue={project.dueDate}
        />
        <FormSelect
          label="Owner"
          name="user_id"
          defaultValue={String(project.userId)}
          options={members}
        />
      </div>

      <FormTextarea
        label="Description"
        name="description"
        rows={4}
        defaultValue={project.description}
      />

      <FormActions>
        <SubmitButton><Phrase>Save</Phrase></SubmitButton>
      </FormActions>
    </form>
  );
}

export function ShareProjectForm({ projectId }: { projectId: number }) {
  const [state, action] = useActionState(shareProjectAction, EMPTY);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      <Messages state={state} />
      <FormInput
        label="Invite by email"
        name="members"
        placeholder="one@example.com, two@example.com"
        hint="Separate multiple addresses with commas"
        error={state.fieldErrors?.members}
      />
      <FormActions>
        <SubmitButton size="sm"><Phrase>Share</Phrase></SubmitButton>
      </FormActions>
    </form>
  );
}

export function TeamForm() {
  const [state, action] = useActionState(storeTeam, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <Messages state={state} />
      <FormInput label="Team Name" name="name" required error={state.fieldErrors?.name} />
      <FormTextarea label="Description" name="description" rows={3} />
      <FormInput
        label="Members"
        name="members"
        placeholder="one@example.com, two@example.com"
        hint="Separate multiple addresses with commas"
      />
      <FormSelect
        label="Privacy"
        name="privacy_type"
        defaultValue="0"
        options={[
          { value: '0', label: 'Public' },
          { value: '1', label: 'Private' },
        ]}
      />
      <FormActions>
        <SubmitButton>Create Team</SubmitButton>
      </FormActions>
    </form>
  );
}

export function TeamSettingsForm({
  team,
}: {
  team: { id: number; name: string; description: string };
}) {
  const [state, action] = useActionState(saveTeam, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={team.id} />
      <Messages state={state} />
      <FormInput label="Team Name" name="name" defaultValue={team.name} required />
      <FormTextarea
        label="Description"
        name="description"
        rows={3}
        defaultValue={team.description}
      />
      <FormActions>
        <SubmitButton size="sm"><Phrase>Save</Phrase></SubmitButton>
      </FormActions>
    </form>
  );
}

export function TeamInviteForm({ teamId }: { teamId: number }) {
  const [state, action] = useActionState(inviteToTeam, EMPTY);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="team_id" value={teamId} />
      <Messages state={state} />
      <FormInput
        label="Invite by email"
        name="members"
        placeholder="one@example.com, two@example.com"
        error={state.fieldErrors?.members}
      />
      <FormActions>
        <SubmitButton size="sm">Invite</SubmitButton>
      </FormActions>
    </form>
  );
}

export function WorkspaceForm() {
  const [state, action] = useActionState(storeWorkspace, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <Messages state={state} />
      <FormInput label="Workspace Name" name="name" required error={state.fieldErrors?.name} />
      <FormInput
        label="Members"
        name="members"
        placeholder="one@example.com, two@example.com"
        hint="A team of the same name is created with these members"
      />
      <FormActions>
        <SubmitButton>Create Workspace</SubmitButton>
      </FormActions>
    </form>
  );
}
