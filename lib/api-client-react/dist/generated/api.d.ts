import type { DataTag, DefinedInitialDataOptions, DefinedUseQueryResult, QueryClient, QueryKey, UndefinedInitialDataOptions, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { Draft, DraftInput, HealthStatus, OwnerWorkspace, Project, ProjectInput, ProjectWorkspaceInput, Run, RunInput, Task, TaskUpdate, TeamWorkspaceInput, Workspace, WorkspaceInvite, WorkspaceInviteInput } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof healthCheck>>, TError, Awaited<ReturnType<typeof healthCheck>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof healthCheck>>, TError, Awaited<ReturnType<typeof healthCheck>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getListWorkspacesUrl: () => string;
export declare const listWorkspaces: (options?: Parameters<typeof customFetch>[1]) => Promise<OwnerWorkspace[]>;
export declare const getListWorkspacesQueryKey: () => readonly ["/api/workspaces"];
export declare const getListWorkspacesQueryOptions: <TData = Awaited<ReturnType<typeof listWorkspaces>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listWorkspaces>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listWorkspaces>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type ListWorkspacesQueryResult = NonNullable<Awaited<ReturnType<typeof listWorkspaces>>>;
export type ListWorkspacesQueryError = ErrorType<unknown>;
export declare function useListWorkspaces<TData = Awaited<ReturnType<typeof listWorkspaces>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof listWorkspaces>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof listWorkspaces>>, TError, Awaited<ReturnType<typeof listWorkspaces>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListWorkspaces<TData = Awaited<ReturnType<typeof listWorkspaces>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listWorkspaces>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof listWorkspaces>>, TError, Awaited<ReturnType<typeof listWorkspaces>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListWorkspaces<TData = Awaited<ReturnType<typeof listWorkspaces>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listWorkspaces>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getCreateWorkspaceUrl: () => string;
export declare const createWorkspace: (teamWorkspaceInput: TeamWorkspaceInput, options?: Parameters<typeof customFetch>[1]) => Promise<OwnerWorkspace>;
export declare const getCreateWorkspaceMutationKey: () => readonly ["createWorkspace"];
export declare const getCreateWorkspaceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createWorkspace>>, TError, CreateWorkspaceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createWorkspace>>, TError, CreateWorkspaceMutationVariables, TContext>;
export type CreateWorkspaceMutationResult = NonNullable<Awaited<ReturnType<typeof createWorkspace>>>;
export type CreateWorkspaceMutationBody = BodyType<TeamWorkspaceInput>;
export type CreateWorkspaceMutationError = ErrorType<unknown>;
export type CreateWorkspaceMutationVariables = {
    data: BodyType<TeamWorkspaceInput>;
};
export declare const useCreateWorkspace: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createWorkspace>>, TError, CreateWorkspaceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof createWorkspace>>, TError, CreateWorkspaceMutationVariables, TContext>;
export declare const getCreateWorkspaceInviteUrl: (workspaceId: string) => string;
export declare const createWorkspaceInvite: (workspaceId: string, options?: Parameters<typeof customFetch>[1]) => Promise<WorkspaceInvite>;
export declare const getCreateWorkspaceInviteMutationKey: () => readonly ["createWorkspaceInvite"];
export declare const getCreateWorkspaceInviteMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createWorkspaceInvite>>, TError, CreateWorkspaceInviteMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createWorkspaceInvite>>, TError, CreateWorkspaceInviteMutationVariables, TContext>;
export type CreateWorkspaceInviteMutationResult = NonNullable<Awaited<ReturnType<typeof createWorkspaceInvite>>>;
export type CreateWorkspaceInviteMutationError = ErrorType<unknown>;
export type CreateWorkspaceInviteMutationVariables = {
    workspaceId: string;
};
export declare const useCreateWorkspaceInvite: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createWorkspaceInvite>>, TError, CreateWorkspaceInviteMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof createWorkspaceInvite>>, TError, CreateWorkspaceInviteMutationVariables, TContext>;
export declare const getAcceptWorkspaceInviteUrl: () => string;
export declare const acceptWorkspaceInvite: (workspaceInviteInput: WorkspaceInviteInput, options?: Parameters<typeof customFetch>[1]) => Promise<OwnerWorkspace>;
export declare const getAcceptWorkspaceInviteMutationKey: () => readonly ["acceptWorkspaceInvite"];
export declare const getAcceptWorkspaceInviteMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof acceptWorkspaceInvite>>, TError, AcceptWorkspaceInviteMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof acceptWorkspaceInvite>>, TError, AcceptWorkspaceInviteMutationVariables, TContext>;
export type AcceptWorkspaceInviteMutationResult = NonNullable<Awaited<ReturnType<typeof acceptWorkspaceInvite>>>;
export type AcceptWorkspaceInviteMutationBody = BodyType<WorkspaceInviteInput>;
export type AcceptWorkspaceInviteMutationError = ErrorType<unknown>;
export type AcceptWorkspaceInviteMutationVariables = {
    data: BodyType<WorkspaceInviteInput>;
};
export declare const useAcceptWorkspaceInvite: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof acceptWorkspaceInvite>>, TError, AcceptWorkspaceInviteMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof acceptWorkspaceInvite>>, TError, AcceptWorkspaceInviteMutationVariables, TContext>;
export declare const getListProjectsUrl: () => string;
export declare const listProjects: (options?: Parameters<typeof customFetch>[1]) => Promise<Project[]>;
export declare const getListProjectsQueryKey: () => readonly ["/api/projects"];
export declare const getListProjectsQueryOptions: <TData = Awaited<ReturnType<typeof listProjects>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listProjects>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listProjects>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type ListProjectsQueryResult = NonNullable<Awaited<ReturnType<typeof listProjects>>>;
export type ListProjectsQueryError = ErrorType<unknown>;
export declare function useListProjects<TData = Awaited<ReturnType<typeof listProjects>>, TError = ErrorType<unknown>>(options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof listProjects>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof listProjects>>, TError, Awaited<ReturnType<typeof listProjects>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListProjects<TData = Awaited<ReturnType<typeof listProjects>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listProjects>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof listProjects>>, TError, Awaited<ReturnType<typeof listProjects>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useListProjects<TData = Awaited<ReturnType<typeof listProjects>>, TError = ErrorType<unknown>>(options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof listProjects>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getCreateProjectUrl: () => string;
export declare const createProject: (projectInput: ProjectInput, options?: Parameters<typeof customFetch>[1]) => Promise<Workspace>;
export declare const getCreateProjectMutationKey: () => readonly ["createProject"];
export declare const getCreateProjectMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createProject>>, TError, CreateProjectMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createProject>>, TError, CreateProjectMutationVariables, TContext>;
export type CreateProjectMutationResult = NonNullable<Awaited<ReturnType<typeof createProject>>>;
export type CreateProjectMutationBody = BodyType<ProjectInput>;
export type CreateProjectMutationError = ErrorType<unknown>;
export type CreateProjectMutationVariables = {
    data: BodyType<ProjectInput>;
};
export declare const useCreateProject: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createProject>>, TError, CreateProjectMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof createProject>>, TError, CreateProjectMutationVariables, TContext>;
export declare const getGetWorkspaceUrl: (projectId: string) => string;
export declare const getWorkspace: (projectId: string, options?: Parameters<typeof customFetch>[1]) => Promise<Workspace>;
export declare const getGetWorkspaceQueryKey: (projectId: string) => readonly [`/api/projects/${string}`];
export declare const getGetWorkspaceQueryOptions: <TData = Awaited<ReturnType<typeof getWorkspace>>, TError = ErrorType<unknown>>(projectId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWorkspace>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getWorkspace>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetWorkspaceQueryResult = NonNullable<Awaited<ReturnType<typeof getWorkspace>>>;
export type GetWorkspaceQueryError = ErrorType<unknown>;
export declare function useGetWorkspace<TData = Awaited<ReturnType<typeof getWorkspace>>, TError = ErrorType<unknown>>(projectId: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWorkspace>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getWorkspace>>, TError, Awaited<ReturnType<typeof getWorkspace>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetWorkspace<TData = Awaited<ReturnType<typeof getWorkspace>>, TError = ErrorType<unknown>>(projectId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWorkspace>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getWorkspace>>, TError, Awaited<ReturnType<typeof getWorkspace>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetWorkspace<TData = Awaited<ReturnType<typeof getWorkspace>>, TError = ErrorType<unknown>>(projectId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getWorkspace>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getMoveProjectToWorkspaceUrl: (projectId: string) => string;
export declare const moveProjectToWorkspace: (projectId: string, projectWorkspaceInput: ProjectWorkspaceInput, options?: Parameters<typeof customFetch>[1]) => Promise<Workspace>;
export declare const getMoveProjectToWorkspaceMutationKey: () => readonly ["moveProjectToWorkspace"];
export declare const getMoveProjectToWorkspaceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof moveProjectToWorkspace>>, TError, MoveProjectToWorkspaceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof moveProjectToWorkspace>>, TError, MoveProjectToWorkspaceMutationVariables, TContext>;
export type MoveProjectToWorkspaceMutationResult = NonNullable<Awaited<ReturnType<typeof moveProjectToWorkspace>>>;
export type MoveProjectToWorkspaceMutationBody = BodyType<ProjectWorkspaceInput>;
export type MoveProjectToWorkspaceMutationError = ErrorType<unknown>;
export type MoveProjectToWorkspaceMutationVariables = {
    projectId: string;
    data: BodyType<ProjectWorkspaceInput>;
};
export declare const useMoveProjectToWorkspace: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof moveProjectToWorkspace>>, TError, MoveProjectToWorkspaceMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof moveProjectToWorkspace>>, TError, MoveProjectToWorkspaceMutationVariables, TContext>;
export declare const getSaveDraftUrl: (projectId: string) => string;
export declare const saveDraft: (projectId: string, draftInput: DraftInput, options?: Parameters<typeof customFetch>[1]) => Promise<Draft>;
export declare const getSaveDraftMutationKey: () => readonly ["saveDraft"];
export declare const getSaveDraftMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof saveDraft>>, TError, SaveDraftMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof saveDraft>>, TError, SaveDraftMutationVariables, TContext>;
export type SaveDraftMutationResult = NonNullable<Awaited<ReturnType<typeof saveDraft>>>;
export type SaveDraftMutationBody = BodyType<DraftInput>;
export type SaveDraftMutationError = ErrorType<unknown>;
export type SaveDraftMutationVariables = {
    projectId: string;
    data: BodyType<DraftInput>;
};
export declare const useSaveDraft: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof saveDraft>>, TError, SaveDraftMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof saveDraft>>, TError, SaveDraftMutationVariables, TContext>;
export declare const getUpdateTaskUrl: (projectId: string, taskId: string) => string;
export declare const updateTask: (projectId: string, taskId: string, taskUpdate: TaskUpdate, options?: Parameters<typeof customFetch>[1]) => Promise<Task>;
export declare const getUpdateTaskMutationKey: () => readonly ["updateTask"];
export declare const getUpdateTaskMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTask>>, TError, UpdateTaskMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateTask>>, TError, UpdateTaskMutationVariables, TContext>;
export type UpdateTaskMutationResult = NonNullable<Awaited<ReturnType<typeof updateTask>>>;
export type UpdateTaskMutationBody = BodyType<TaskUpdate>;
export type UpdateTaskMutationError = ErrorType<unknown>;
export type UpdateTaskMutationVariables = {
    projectId: string;
    taskId: string;
    data: BodyType<TaskUpdate>;
};
export declare const useUpdateTask: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTask>>, TError, UpdateTaskMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof updateTask>>, TError, UpdateTaskMutationVariables, TContext>;
export declare const getStartRunUrl: (projectId: string) => string;
export declare const startRun: (projectId: string, runInput: RunInput, options?: Parameters<typeof customFetch>[1]) => Promise<Run>;
export declare const getStartRunMutationKey: () => readonly ["startRun"];
export declare const getStartRunMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof startRun>>, TError, StartRunMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof startRun>>, TError, StartRunMutationVariables, TContext>;
export type StartRunMutationResult = NonNullable<Awaited<ReturnType<typeof startRun>>>;
export type StartRunMutationBody = BodyType<RunInput>;
export type StartRunMutationError = ErrorType<unknown>;
export type StartRunMutationVariables = {
    projectId: string;
    data: BodyType<RunInput>;
};
export declare const useStartRun: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof startRun>>, TError, StartRunMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof startRun>>, TError, StartRunMutationVariables, TContext>;
export declare const getGetRunUrl: (runId: string) => string;
export declare const getRun: (runId: string, options?: Parameters<typeof customFetch>[1]) => Promise<Run>;
export declare const getGetRunQueryKey: (runId: string) => readonly [`/api/runs/${string}`];
export declare const getGetRunQueryOptions: <TData = Awaited<ReturnType<typeof getRun>>, TError = ErrorType<unknown>>(runId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getRun>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getRun>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type GetRunQueryResult = NonNullable<Awaited<ReturnType<typeof getRun>>>;
export type GetRunQueryError = ErrorType<unknown>;
export declare function useGetRun<TData = Awaited<ReturnType<typeof getRun>>, TError = ErrorType<unknown>>(runId: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof getRun>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof getRun>>, TError, Awaited<ReturnType<typeof getRun>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetRun<TData = Awaited<ReturnType<typeof getRun>>, TError = ErrorType<unknown>>(runId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getRun>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof getRun>>, TError, Awaited<ReturnType<typeof getRun>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useGetRun<TData = Awaited<ReturnType<typeof getRun>>, TError = ErrorType<unknown>>(runId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getRun>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare const getRetryRunUrl: (runId: string) => string;
export declare const retryRun: (runId: string, options?: Parameters<typeof customFetch>[1]) => Promise<Run>;
export declare const getRetryRunMutationKey: () => readonly ["retryRun"];
export declare const getRetryRunMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof retryRun>>, TError, RetryRunMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof retryRun>>, TError, RetryRunMutationVariables, TContext>;
export type RetryRunMutationResult = NonNullable<Awaited<ReturnType<typeof retryRun>>>;
export type RetryRunMutationError = ErrorType<unknown>;
export type RetryRunMutationVariables = {
    runId: string;
};
export declare const useRetryRun: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof retryRun>>, TError, RetryRunMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof retryRun>>, TError, RetryRunMutationVariables, TContext>;
export declare const getAcknowledgeRunUrl: (runId: string) => string;
export declare const acknowledgeRun: (runId: string, options?: Parameters<typeof customFetch>[1]) => Promise<Run>;
export declare const getAcknowledgeRunMutationKey: () => readonly ["acknowledgeRun"];
export declare const getAcknowledgeRunMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof acknowledgeRun>>, TError, AcknowledgeRunMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof acknowledgeRun>>, TError, AcknowledgeRunMutationVariables, TContext>;
export type AcknowledgeRunMutationResult = NonNullable<Awaited<ReturnType<typeof acknowledgeRun>>>;
export type AcknowledgeRunMutationError = ErrorType<unknown>;
export type AcknowledgeRunMutationVariables = {
    runId: string;
};
export declare const useAcknowledgeRun: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof acknowledgeRun>>, TError, AcknowledgeRunMutationVariables, TContext>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient) => UseMutationResult<Awaited<ReturnType<typeof acknowledgeRun>>, TError, AcknowledgeRunMutationVariables, TContext>;
export declare const getStreamRunUrl: (runId: string) => string;
export declare const streamRun: (runId: string, options?: Parameters<typeof customFetch>[1]) => Promise<string>;
export declare const getStreamRunQueryKey: (runId: string) => readonly [`/api/runs/${string}/events`];
export declare const getStreamRunQueryOptions: <TData = Awaited<ReturnType<typeof streamRun>>, TError = ErrorType<unknown>>(runId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof streamRun>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof streamRun>>, TError, TData> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export type StreamRunQueryResult = NonNullable<Awaited<ReturnType<typeof streamRun>>>;
export type StreamRunQueryError = ErrorType<unknown>;
export declare function useStreamRun<TData = Awaited<ReturnType<typeof streamRun>>, TError = ErrorType<unknown>>(runId: string, options: {
    query: Partial<UseQueryOptions<Awaited<ReturnType<typeof streamRun>>, TError, TData>> & Pick<DefinedInitialDataOptions<Awaited<ReturnType<typeof streamRun>>, TError, Awaited<ReturnType<typeof streamRun>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): DefinedUseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useStreamRun<TData = Awaited<ReturnType<typeof streamRun>>, TError = ErrorType<unknown>>(runId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof streamRun>>, TError, TData>> & Pick<UndefinedInitialDataOptions<Awaited<ReturnType<typeof streamRun>>, TError, Awaited<ReturnType<typeof streamRun>>>, 'initialData'>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export declare function useStreamRun<TData = Awaited<ReturnType<typeof streamRun>>, TError = ErrorType<unknown>>(runId: string, options?: {
    query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof streamRun>>, TError, TData>>;
    request?: SecondParameter<typeof customFetch>;
}, queryClient?: QueryClient): UseQueryResult<TData, TError> & {
    queryKey: DataTag<QueryKey, TData, TError>;
};
export {};
//# sourceMappingURL=api.d.ts.map