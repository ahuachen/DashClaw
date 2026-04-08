export function createCheck({
  id,
  label,
  status,
  detail,
  subDetail = '',
  likelyCause = '',
  nextAction = '',
  publicDetail,
  publicSubDetail,
}) {
  return {
    id,
    label,
    status,
    detail,
    subDetail,
    likelyCause,
    nextAction,
    publicDetail: publicDetail ?? detail,
    publicSubDetail: publicSubDetail ?? subDetail,
  };
}

export function createSection({
  id,
  title,
  status,
  description,
  summary,
  whatWasChecked,
  evidenceSummary = '',
  pendingProof = '',
  checks,
  ...rest
}) {
  return {
    id,
    title,
    status,
    description,
    summary,
    whatWasChecked,
    evidenceSummary,
    pendingProof,
    checks,
    ...rest,
  };
}

export function createStep({
  id,
  title,
  variant,
  summary,
  details = [],
  code = '',
  publicCode,
  note = '',
  publicNote,
}) {
  return {
    id,
    title,
    variant,
    summary,
    details,
    code,
    publicCode: publicCode ?? code,
    note,
    publicNote: publicNote ?? note,
  };
}

export function createWorkflowStep({ id, title, status, summary, proof, nextAction }) {
  return {
    id,
    title,
    status,
    summary,
    proof,
    nextAction,
  };
}
