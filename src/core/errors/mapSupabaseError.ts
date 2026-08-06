import AppError from './AppError';

export function mapSupabaseError(err: any): AppError {
  if (!err) return new AppError('Erro desconhecido');
  const code = err.code || err.status || err?.hint || err?.message;
  const pgcode = err?.details || err?.hint || err?.code || err?.message;

  // Map known PostgREST / Postgres codes
  const mapping: Record<string, string> = {
    'PGRST116': 'Registro não encontrado',
    '23505': 'Já existe um registro com esses dados',
    '23503': 'Não é possível excluir: existem registros vinculados',
    '42501': 'Você não tem permissão para esta operação',
  };

  // Try common places for codes
  const candidates = [err.code?.toString?.(), err?.status?.toString?.(), err?.details?.toString?.(), err?.hint?.toString?.(), err?.message?.toString?.()];
  for (const c of candidates) {
    if (!c) continue;
    for (const key of Object.keys(mapping)) {
      if (c.includes(key)) {
        return new AppError(mapping[key], key, err);
      }
    }
  }

  // Fallback: if there's a status code number like 23505
  if (typeof err === 'object' && err?.code && mapping[err.code]) {
    return new AppError(mapping[err.code], err.code, err);
  }

  // Generic
  return new AppError(err.message || 'Erro do Supabase', code, err);
}

export default mapSupabaseError;
