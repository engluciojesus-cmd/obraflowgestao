export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          company_id: string
          created_at: string | null
          documento: string | null
          email: string | null
          id: string
          nome: string
          status: string
          telefone: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          nome: string
          status?: string
          telefone?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          nome?: string
          status?: string
          telefone?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean | null
          cnpj: string | null
          created_at: string | null
          created_by: string | null
          id: string
          logo_url: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          can_manage_users: boolean | null
          company_id: string
          created_at: string | null
          id: string
          modulos: string[] | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_manage_users?: boolean | null
          company_id: string
          created_at?: string | null
          id?: string
          modulos?: string[] | null
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_manage_users?: boolean | null
          company_id?: string
          created_at?: string | null
          id?: string
          modulos?: string[] | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      composicao_itens: {
        Row: {
          coeficiente: number
          composicao_id: string
          created_at: string
          id: string
          insumo_canonico_id: string
          obrigatorio: boolean
          observacao: string | null
          perda_percentual: number
        }
        Insert: {
          coeficiente: number
          composicao_id: string
          created_at?: string
          id?: string
          insumo_canonico_id: string
          obrigatorio?: boolean
          observacao?: string | null
          perda_percentual?: number
        }
        Update: {
          coeficiente?: number
          composicao_id?: string
          created_at?: string
          id?: string
          insumo_canonico_id?: string
          obrigatorio?: boolean
          observacao?: string | null
          perda_percentual?: number
        }
        Relationships: [
          {
            foreignKeyName: "composicao_itens_composicao_id_fkey"
            columns: ["composicao_id"]
            isOneToOne: false
            referencedRelation: "composicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composicao_itens_insumo_canonico_id_fkey"
            columns: ["insumo_canonico_id"]
            isOneToOne: false
            referencedRelation: "insumos_canonicos"
            referencedColumns: ["id"]
          },
        ]
      }
      composicoes: {
        Row: {
          ativo: boolean
          codigo: string | null
          company_id: string | null
          created_at: string
          descricao: string
          embedding: string | null
          fonte: string
          id: string
          unidade: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          company_id?: string | null
          created_at?: string
          descricao: string
          embedding?: string | null
          fonte?: string
          id?: string
          unidade: string
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          company_id?: string | null
          created_at?: string
          descricao?: string
          embedding?: string | null
          fonte?: string
          id?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "composicoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_itens: {
        Row: {
          contrato_id: string
          descricao: string
          id: string
          orcamento_item_id: string | null
          ordem: number
          quantidade: number
          unidade: string | null
          valor_unitario: number
        }
        Insert: {
          contrato_id: string
          descricao: string
          id?: string
          orcamento_item_id?: string | null
          ordem?: number
          quantidade?: number
          unidade?: string | null
          valor_unitario?: number
        }
        Update: {
          contrato_id?: string
          descricao?: string
          id?: string
          orcamento_item_id?: string | null
          ordem?: number
          quantidade?: number
          unidade?: string | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_itens_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_itens_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          company_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          fornecedor_id: string | null
          id: string
          identificador: string
          numero: number
          obra_id: string | null
          status: string
          valor: number
        }
        Insert: {
          company_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          identificador: string
          numero: number
          obra_id?: string | null
          status?: string
          valor?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          identificador?: string
          numero?: number
          obra_id?: string | null
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacao_fornecedores: {
        Row: {
          company_id: string | null
          condicao_pagamento: string | null
          cotacao_id: string
          created_at: string
          desconto_global_pct: number
          fornecedor_id: string
          frete: number
          id: string
          observacao: string | null
          prazo_entrega_dias: number
          prazo_pagamento_dias: number
          respondeu: boolean
          respondido_em: string | null
        }
        Insert: {
          company_id?: string | null
          condicao_pagamento?: string | null
          cotacao_id: string
          created_at?: string
          desconto_global_pct?: number
          fornecedor_id: string
          frete?: number
          id?: string
          observacao?: string | null
          prazo_entrega_dias?: number
          prazo_pagamento_dias?: number
          respondeu?: boolean
          respondido_em?: string | null
        }
        Update: {
          company_id?: string | null
          condicao_pagamento?: string | null
          cotacao_id?: string
          created_at?: string
          desconto_global_pct?: number
          fornecedor_id?: string
          frete?: number
          id?: string
          observacao?: string | null
          prazo_entrega_dias?: number
          prazo_pagamento_dias?: number
          respondeu?: boolean
          respondido_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacao_fornecedores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_fornecedores_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_fornecedores_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["cotacao_id"]
          },
          {
            foreignKeyName: "cotacao_fornecedores_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacao_itens: {
        Row: {
          company_id: string | null
          cotacao_id: string
          descricao: string
          id: string
          orcamento_item_id: string | null
          ordem: number
          quantidade: number
          requisicao_item_id: string | null
          unidade: string | null
        }
        Insert: {
          company_id?: string | null
          cotacao_id: string
          descricao: string
          id?: string
          orcamento_item_id?: string | null
          ordem?: number
          quantidade?: number
          requisicao_item_id?: string | null
          unidade?: string | null
        }
        Update: {
          company_id?: string | null
          cotacao_id?: string
          descricao?: string
          id?: string
          orcamento_item_id?: string | null
          ordem?: number
          quantidade?: number
          requisicao_item_id?: string | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacao_itens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_itens_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_itens_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["cotacao_id"]
          },
          {
            foreignKeyName: "cotacao_itens_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_itens_requisicao_item_id_fkey"
            columns: ["requisicao_item_id"]
            isOneToOne: false
            referencedRelation: "requisicao_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacao_precos: {
        Row: {
          company_id: string | null
          cotacao_fornecedor_id: string
          cotacao_item_id: string
          disponivel: boolean
          escolhido: boolean
          id: string
          marca: string | null
          prazo_dias: number | null
          valor_unitario: number
        }
        Insert: {
          company_id?: string | null
          cotacao_fornecedor_id: string
          cotacao_item_id: string
          disponivel?: boolean
          escolhido?: boolean
          id?: string
          marca?: string | null
          prazo_dias?: number | null
          valor_unitario?: number
        }
        Update: {
          company_id?: string | null
          cotacao_fornecedor_id?: string
          cotacao_item_id?: string
          disponivel?: boolean
          escolhido?: boolean
          id?: string
          marca?: string | null
          prazo_dias?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotacao_precos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_precos_cotacao_fornecedor_id_fkey"
            columns: ["cotacao_fornecedor_id"]
            isOneToOne: false
            referencedRelation: "cotacao_fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_precos_cotacao_item_id_fkey"
            columns: ["cotacao_item_id"]
            isOneToOne: false
            referencedRelation: "cotacao_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes: {
        Row: {
          company_id: string
          created_at: string
          data_limite: string | null
          descricao: string | null
          id: string
          numero: number
          obra_id: string | null
          observacao: string | null
          processo_id: string | null
          requisicao_id: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          data_limite?: string | null
          descricao?: string | null
          id?: string
          numero: number
          obra_id?: string | null
          observacao?: string | null
          processo_id?: string | null
          requisicao_id?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          data_limite?: string | null
          descricao?: string | null
          id?: string
          numero?: number
          obra_id?: string | null
          observacao?: string | null
          processo_id?: string | null
          requisicao_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["processo_id"]
          },
          {
            foreignKeyName: "cotacoes_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "requisicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["requisicao_id"]
          },
        ]
      }
      documento_chunks: {
        Row: {
          company_id: string
          conteudo: string
          created_at: string
          documento_id: string
          embedding: string | null
          id: number
          ordem: number
          pagina: number | null
        }
        Insert: {
          company_id: string
          conteudo: string
          created_at?: string
          documento_id: string
          embedding?: string | null
          id?: never
          ordem: number
          pagina?: number | null
        }
        Update: {
          company_id?: string
          conteudo?: string
          created_at?: string
          documento_id?: string
          embedding?: string | null
          id?: never
          ordem?: number
          pagina?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_chunks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_chunks_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          company_id: string
          created_at: string
          criado_por: string | null
          id: string
          indexado_em: string | null
          metadata: Json
          mime: string | null
          nome: string
          obra_id: string | null
          paginas: number | null
          storage_path: string
          tamanho_bytes: number | null
          tipo: string
        }
        Insert: {
          company_id: string
          created_at?: string
          criado_por?: string | null
          id?: string
          indexado_em?: string | null
          metadata?: Json
          mime?: string | null
          nome: string
          obra_id?: string | null
          paginas?: number | null
          storage_path: string
          tamanho_bytes?: number | null
          tipo?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          indexado_em?: string | null
          metadata?: Json
          mime?: string | null
          nome?: string
          obra_id?: string | null
          paginas?: number | null
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_movimentos: {
        Row: {
          company_id: string
          created_at: string
          criado_por: string | null
          documento: string | null
          id: number
          insumo_canonico_id: string
          obra_id: string | null
          observacao: string | null
          origem: string | null
          origem_id: string | null
          quantidade: number
          tipo: string
          valor_unitario: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          criado_por?: string | null
          documento?: string | null
          id?: never
          insumo_canonico_id: string
          obra_id?: string | null
          observacao?: string | null
          origem?: string | null
          origem_id?: string | null
          quantidade: number
          tipo: string
          valor_unitario?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          criado_por?: string | null
          documento?: string | null
          id?: never
          insumo_canonico_id?: string
          obra_id?: string | null
          observacao?: string | null
          origem?: string | null
          origem_id?: string | null
          quantidade?: number
          tipo?: string
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentos_insumo_canonico_id_fkey"
            columns: ["insumo_canonico_id"]
            isOneToOne: false
            referencedRelation: "insumos_canonicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          acao: string
          actor_id: string | null
          company_id: string
          diff: Json | null
          entidade: string
          entidade_id: string | null
          id: number
          metadata: Json
          ocorrido_em: string
        }
        Insert: {
          acao: string
          actor_id?: string | null
          company_id: string
          diff?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: never
          metadata?: Json
          ocorrido_em?: string
        }
        Update: {
          acao?: string
          actor_id?: string | null
          company_id?: string
          diff?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: never
          metadata?: Json
          ocorrido_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          avaliacao: number
          categoria: string | null
          cnpj: string | null
          company_id: string
          created_at: string | null
          id: string
          nome: string
          status: string
          updated_at: string | null
        }
        Insert: {
          avaliacao?: number
          categoria?: string | null
          cnpj?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          nome: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          avaliacao?: number
          categoria?: string | null
          cnpj?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          nome?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      insumo_aliases: {
        Row: {
          company_id: string | null
          confianca: number | null
          confirmado: boolean
          confirmado_em: string | null
          confirmado_por: string | null
          created_at: string
          descricao_norm: string | null
          descricao_original: string
          fator_conversao: number
          fornecedor_id: string | null
          id: string
          insumo_canonico_id: string
          origem: string
          unidade_original: string | null
        }
        Insert: {
          company_id?: string | null
          confianca?: number | null
          confirmado?: boolean
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          descricao_norm?: string | null
          descricao_original: string
          fator_conversao?: number
          fornecedor_id?: string | null
          id?: string
          insumo_canonico_id: string
          origem?: string
          unidade_original?: string | null
        }
        Update: {
          company_id?: string | null
          confianca?: number | null
          confirmado?: boolean
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          descricao_norm?: string | null
          descricao_original?: string
          fator_conversao?: number
          fornecedor_id?: string | null
          id?: string
          insumo_canonico_id?: string
          origem?: string
          unidade_original?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insumo_aliases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumo_aliases_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumo_aliases_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumo_aliases_insumo_canonico_id_fkey"
            columns: ["insumo_canonico_id"]
            isOneToOne: false
            referencedRelation: "insumos_canonicos"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos_canonicos: {
        Row: {
          ativo: boolean
          categoria: string | null
          codigo: string | null
          company_id: string | null
          created_at: string
          descricao: string
          embedding: string | null
          especificacoes: Json
          id: string
          ncm: string | null
          subcategoria: string | null
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          codigo?: string | null
          company_id?: string | null
          created_at?: string
          descricao: string
          embedding?: string | null
          especificacoes?: Json
          id?: string
          ncm?: string | null
          subcategoria?: string | null
          unidade: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          codigo?: string | null
          company_id?: string | null
          created_at?: string
          descricao?: string
          embedding?: string | null
          especificacoes?: Json
          id?: string
          ncm?: string | null
          subcategoria?: string | null
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumos_canonicos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          anexo_path: string | null
          company_id: string
          created_at: string | null
          data_pagamento: string | null
          documento_numero: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          id: string
          numero: string | null
          obra_id: string | null
          ordem_compra_id: string | null
          processo_id: string | null
          recebimento_id: string | null
          status: string
          titulo: string
          updated_at: string | null
          valor: number | null
          vencimento: string | null
        }
        Insert: {
          anexo_path?: string | null
          company_id: string
          created_at?: string | null
          data_pagamento?: string | null
          documento_numero?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          numero?: string | null
          obra_id?: string | null
          ordem_compra_id?: string | null
          processo_id?: string | null
          recebimento_id?: string | null
          status?: string
          titulo: string
          updated_at?: string | null
          valor?: number | null
          vencimento?: string | null
        }
        Update: {
          anexo_path?: string | null
          company_id?: string
          created_at?: string | null
          data_pagamento?: string | null
          documento_numero?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          numero?: string | null
          obra_id?: string | null
          ordem_compra_id?: string | null
          processo_id?: string | null
          recebimento_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string | null
          valor?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_ordem_compra_id_fkey"
            columns: ["ordem_compra_id"]
            isOneToOne: false
            referencedRelation: "ordens_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_ordem_compra_id_fkey"
            columns: ["ordem_compra_id"]
            isOneToOne: false
            referencedRelation: "vw_oc_recebimento"
            referencedColumns: ["ordem_compra_id"]
          },
          {
            foreignKeyName: "lancamentos_ordem_compra_id_fkey"
            columns: ["ordem_compra_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["ordem_id"]
          },
          {
            foreignKeyName: "lancamentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["processo_id"]
          },
          {
            foreignKeyName: "lancamentos_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "recebimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["recebimento_id"]
          },
        ]
      }
      medicoes: {
        Row: {
          company_id: string
          contrato_id: string | null
          created_at: string | null
          data: string | null
          id: string
          nome: string
          numero: number | null
          obra_id: string | null
          orcamento_item_id: string | null
          percentual_medido: number
          recebido: number | null
          servico_id: string | null
          status: string
          updated_at: string | null
          valor: number | null
          vencimento: string | null
        }
        Insert: {
          company_id: string
          contrato_id?: string | null
          created_at?: string | null
          data?: string | null
          id?: string
          nome: string
          numero?: number | null
          obra_id?: string | null
          orcamento_item_id?: string | null
          percentual_medido?: number
          recebido?: number | null
          servico_id?: string | null
          status?: string
          updated_at?: string | null
          valor?: number | null
          vencimento?: string | null
        }
        Update: {
          company_id?: string
          contrato_id?: string | null
          created_at?: string | null
          data?: string | null
          id?: string
          nome?: string
          numero?: number | null
          obra_id?: string | null
          orcamento_item_id?: string | null
          percentual_medido?: number
          recebido?: number | null
          servico_id?: string | null
          status?: string
          updated_at?: string | null
          valor?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medicoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "orcamento_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          avanco: number
          cliente_id: string | null
          company_id: string
          created_at: string | null
          id: string
          local: string | null
          nome: string
          prazo: string | null
          status: string
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          avanco?: number
          cliente_id?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          local?: string | null
          nome: string
          prazo?: string | null
          status?: string
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          avanco?: number
          cliente_id?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          local?: string | null
          nome?: string
          prazo?: string | null
          status?: string
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_fases: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          nome: string
          orcamento_id: string
          ordem: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome: string
          orcamento_id: string
          ordem?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          orcamento_id?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_fases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_fases_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_item_composicao: {
        Row: {
          company_id: string
          composicao_id: string
          confianca: number | null
          confirmado: boolean
          created_at: string
          orcamento_item_id: string
          origem: string
        }
        Insert: {
          company_id: string
          composicao_id: string
          confianca?: number | null
          confirmado?: boolean
          created_at?: string
          orcamento_item_id: string
          origem?: string
        }
        Update: {
          company_id?: string
          composicao_id?: string
          confianca?: number | null
          confirmado?: boolean
          created_at?: string
          orcamento_item_id?: string
          origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_item_composicao_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_item_composicao_composicao_id_fkey"
            columns: ["composicao_id"]
            isOneToOne: false
            referencedRelation: "composicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_item_composicao_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: true
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          company_id: string | null
          created_at: string | null
          descricao: string
          id: string
          memoria_calculo: string | null
          modo: string
          observacoes: string | null
          ordem: number
          peso: number | null
          quantidade: number | null
          servico_id: string
          unidade: string | null
          updated_at: string | null
          valor_unitario: number | null
          valor_verba: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          descricao: string
          id?: string
          memoria_calculo?: string | null
          modo?: string
          observacoes?: string | null
          ordem?: number
          peso?: number | null
          quantidade?: number | null
          servico_id: string
          unidade?: string | null
          updated_at?: string | null
          valor_unitario?: number | null
          valor_verba?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          descricao?: string
          id?: string
          memoria_calculo?: string | null
          modo?: string
          observacoes?: string | null
          ordem?: number
          peso?: number | null
          quantidade?: number | null
          servico_id?: string
          unidade?: string | null
          updated_at?: string | null
          valor_unitario?: number | null
          valor_verba?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "orcamento_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_servicos: {
        Row: {
          company_id: string | null
          created_at: string | null
          fase_id: string | null
          id: string
          nome: string
          orcamento_id: string
          ordem: number
          peso: number
          tipo: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          fase_id?: string | null
          id?: string
          nome: string
          orcamento_id: string
          ordem?: number
          peso?: number
          tipo?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          fase_id?: string | null
          id?: string
          nome?: string
          orcamento_id?: string
          ordem?: number
          peso?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_servicos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_servicos_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "orcamento_fases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_servicos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          cliente_id: string | null
          company_id: string
          created_at: string | null
          data: string | null
          id: string
          nome: string
          obra_id: string | null
          percentual_consumo: number
          responsavel: string | null
          status: string
          updated_at: string | null
          usa_fases: boolean
          valor: number | null
        }
        Insert: {
          cliente_id?: string | null
          company_id: string
          created_at?: string | null
          data?: string | null
          id?: string
          nome: string
          obra_id?: string | null
          percentual_consumo?: number
          responsavel?: string | null
          status?: string
          updated_at?: string | null
          usa_fases?: boolean
          valor?: number | null
        }
        Update: {
          cliente_id?: string | null
          company_id?: string
          created_at?: string | null
          data?: string | null
          id?: string
          nome?: string
          obra_id?: string | null
          percentual_consumo?: number
          responsavel?: string | null
          status?: string
          updated_at?: string | null
          usa_fases?: boolean
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_compra_itens: {
        Row: {
          company_id: string | null
          descricao: string
          id: string
          insumo_canonico_id: string | null
          marca: string | null
          orcamento_item_id: string | null
          ordem: number
          ordem_compra_id: string
          quantidade: number
          quantidade_recebida: number
          requisicao_item_id: string | null
          unidade: string | null
          valor_unitario: number
        }
        Insert: {
          company_id?: string | null
          descricao: string
          id?: string
          insumo_canonico_id?: string | null
          marca?: string | null
          orcamento_item_id?: string | null
          ordem?: number
          ordem_compra_id: string
          quantidade?: number
          quantidade_recebida?: number
          requisicao_item_id?: string | null
          unidade?: string | null
          valor_unitario?: number
        }
        Update: {
          company_id?: string | null
          descricao?: string
          id?: string
          insumo_canonico_id?: string | null
          marca?: string | null
          orcamento_item_id?: string | null
          ordem?: number
          ordem_compra_id?: string
          quantidade?: number
          quantidade_recebida?: number
          requisicao_item_id?: string | null
          unidade?: string | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordem_compra_itens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_compra_itens_insumo_canonico_id_fkey"
            columns: ["insumo_canonico_id"]
            isOneToOne: false
            referencedRelation: "insumos_canonicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_compra_itens_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_compra_itens_ordem_compra_id_fkey"
            columns: ["ordem_compra_id"]
            isOneToOne: false
            referencedRelation: "ordens_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_compra_itens_ordem_compra_id_fkey"
            columns: ["ordem_compra_id"]
            isOneToOne: false
            referencedRelation: "vw_oc_recebimento"
            referencedColumns: ["ordem_compra_id"]
          },
          {
            foreignKeyName: "ordem_compra_itens_ordem_compra_id_fkey"
            columns: ["ordem_compra_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["ordem_id"]
          },
          {
            foreignKeyName: "ordem_compra_itens_requisicao_item_id_fkey"
            columns: ["requisicao_item_id"]
            isOneToOne: false
            referencedRelation: "requisicao_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_compra: {
        Row: {
          avaliacao_obs: string | null
          avaliacao_prazo: number | null
          avaliacao_qualidade: number | null
          company_id: string
          condicao_pagamento: string
          cotacao_id: string | null
          created_at: string
          data_envio: string | null
          desconto: number
          endereco_entrega: string | null
          enviado_por: string | null
          fornecedor_id: string | null
          frete: number
          id: string
          motivo_cancelamento: string | null
          numero: number
          obra_id: string | null
          observacao: string | null
          previsao_entrega: string | null
          processo_id: string | null
          requisicao_id: string | null
          status: string
          valor: number
        }
        Insert: {
          avaliacao_obs?: string | null
          avaliacao_prazo?: number | null
          avaliacao_qualidade?: number | null
          company_id: string
          condicao_pagamento: string
          cotacao_id?: string | null
          created_at?: string
          data_envio?: string | null
          desconto?: number
          endereco_entrega?: string | null
          enviado_por?: string | null
          fornecedor_id?: string | null
          frete?: number
          id?: string
          motivo_cancelamento?: string | null
          numero: number
          obra_id?: string | null
          observacao?: string | null
          previsao_entrega?: string | null
          processo_id?: string | null
          requisicao_id?: string | null
          status?: string
          valor?: number
        }
        Update: {
          avaliacao_obs?: string | null
          avaliacao_prazo?: number | null
          avaliacao_qualidade?: number | null
          company_id?: string
          condicao_pagamento?: string
          cotacao_id?: string | null
          created_at?: string
          data_envio?: string | null
          desconto?: number
          endereco_entrega?: string | null
          enviado_por?: string | null
          fornecedor_id?: string | null
          frete?: number
          id?: string
          motivo_cancelamento?: string | null
          numero?: number
          obra_id?: string | null
          observacao?: string | null
          previsao_entrega?: string | null
          processo_id?: string | null
          requisicao_id?: string | null
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_compra_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_compra_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_compra_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["cotacao_id"]
          },
          {
            foreignKeyName: "ordens_compra_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_compra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_compra_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_compra_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["processo_id"]
          },
          {
            foreignKeyName: "ordens_compra_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "requisicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_compra_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["requisicao_id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          company_id: string | null
          created_at: string | null
          descricao: string
          id: string
          orcamento_item_id: string | null
          pedido_id: string
          quantidade: number | null
          valor_unitario: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          descricao: string
          id?: string
          orcamento_item_id?: string | null
          pedido_id: string
          quantidade?: number | null
          valor_unitario?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          descricao?: string
          id?: string
          orcamento_item_id?: string | null
          pedido_id?: string
          quantidade?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          company_id: string
          created_at: string | null
          data: string | null
          data_entrega_prevista: string | null
          data_entrega_real: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          houve_devolucao: boolean
          id: string
          obra_id: string | null
          quantidade_divergente: boolean
          status: string
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          data?: string | null
          data_entrega_prevista?: string | null
          data_entrega_real?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          houve_devolucao?: boolean
          id?: string
          obra_id?: string | null
          quantidade_divergente?: boolean
          status?: string
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          data?: string | null
          data_entrega_prevista?: string | null
          data_entrega_real?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          houve_devolucao?: boolean
          id?: string
          obra_id?: string | null
          quantidade_divergente?: boolean
          status?: string
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      precos_historicos: {
        Row: {
          company_id: string
          created_at: string
          data: string
          descricao_original: string | null
          fornecedor_id: string | null
          id: number
          insumo_canonico_id: string | null
          municipio: string | null
          obra_id: string | null
          origem: string
          origem_id: string | null
          quantidade: number
          uf: string | null
          unidade: string | null
          valor_canonico: number | null
          valor_unitario: number
        }
        Insert: {
          company_id: string
          created_at?: string
          data?: string
          descricao_original?: string | null
          fornecedor_id?: string | null
          id?: never
          insumo_canonico_id?: string | null
          municipio?: string | null
          obra_id?: string | null
          origem: string
          origem_id?: string | null
          quantidade?: number
          uf?: string | null
          unidade?: string | null
          valor_canonico?: number | null
          valor_unitario: number
        }
        Update: {
          company_id?: string
          created_at?: string
          data?: string
          descricao_original?: string | null
          fornecedor_id?: string | null
          id?: never
          insumo_canonico_id?: string | null
          municipio?: string | null
          obra_id?: string | null
          origem?: string
          origem_id?: string | null
          quantidade?: number
          uf?: string | null
          unidade?: string | null
          valor_canonico?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "precos_historicos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_historicos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_historicos_insumo_canonico_id_fkey"
            columns: ["insumo_canonico_id"]
            isOneToOne: false
            referencedRelation: "insumos_canonicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_historicos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_compra: {
        Row: {
          ano: number
          company_id: string
          created_at: string
          criado_por: string | null
          id: string
          numero_processo: string
          obra_id: string | null
          origem: string
          sequencial: number
        }
        Insert: {
          ano?: number
          company_id: string
          created_at?: string
          criado_por?: string | null
          id?: string
          numero_processo: string
          obra_id?: string | null
          origem?: string
          sequencial: number
        }
        Update: {
          ano?: number
          company_id?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          numero_processo?: string
          obra_id?: string | null
          origem?: string
          sequencial?: number
        }
        Relationships: [
          {
            foreignKeyName: "processos_compra_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_compra_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_compra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimento_itens: {
        Row: {
          company_id: string
          conforme: boolean
          created_at: string
          id: string
          observacao: string | null
          ordem_compra_item_id: string
          quantidade: number
          recebimento_id: string
          valor_unitario: number | null
        }
        Insert: {
          company_id: string
          conforme?: boolean
          created_at?: string
          id?: string
          observacao?: string | null
          ordem_compra_item_id: string
          quantidade: number
          recebimento_id: string
          valor_unitario?: number | null
        }
        Update: {
          company_id?: string
          conforme?: boolean
          created_at?: string
          id?: string
          observacao?: string | null
          ordem_compra_item_id?: string
          quantidade?: number
          recebimento_id?: string
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recebimento_itens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimento_itens_ordem_compra_item_id_fkey"
            columns: ["ordem_compra_item_id"]
            isOneToOne: false
            referencedRelation: "ordem_compra_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimento_itens_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "recebimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimento_itens_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["recebimento_id"]
          },
        ]
      }
      recebimentos: {
        Row: {
          chave_nfe: string | null
          company_id: string
          created_at: string
          data_recebimento: string
          divergencia: Json | null
          divergencia_aceita: boolean | null
          documento_numero: string | null
          documento_path: string | null
          documento_serie: string | null
          documento_valor: number | null
          id: string
          observacao: string | null
          ocr_payload: Json | null
          ordem_compra_id: string
          processo_id: string | null
          recebido_por: string | null
          sequencia: number
        }
        Insert: {
          chave_nfe?: string | null
          company_id: string
          created_at?: string
          data_recebimento?: string
          divergencia?: Json | null
          divergencia_aceita?: boolean | null
          documento_numero?: string | null
          documento_path?: string | null
          documento_serie?: string | null
          documento_valor?: number | null
          id?: string
          observacao?: string | null
          ocr_payload?: Json | null
          ordem_compra_id: string
          processo_id?: string | null
          recebido_por?: string | null
          sequencia?: number
        }
        Update: {
          chave_nfe?: string | null
          company_id?: string
          created_at?: string
          data_recebimento?: string
          divergencia?: Json | null
          divergencia_aceita?: boolean | null
          documento_numero?: string | null
          documento_path?: string | null
          documento_serie?: string | null
          documento_valor?: number | null
          id?: string
          observacao?: string | null
          ocr_payload?: Json | null
          ordem_compra_id?: string
          processo_id?: string | null
          recebido_por?: string | null
          sequencia?: number
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_ordem_compra_id_fkey"
            columns: ["ordem_compra_id"]
            isOneToOne: false
            referencedRelation: "ordens_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_ordem_compra_id_fkey"
            columns: ["ordem_compra_id"]
            isOneToOne: false
            referencedRelation: "vw_oc_recebimento"
            referencedColumns: ["ordem_compra_id"]
          },
          {
            foreignKeyName: "recebimentos_ordem_compra_id_fkey"
            columns: ["ordem_compra_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["ordem_id"]
          },
          {
            foreignKeyName: "recebimentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["processo_id"]
          },
          {
            foreignKeyName: "recebimentos_recebido_por_fkey"
            columns: ["recebido_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      requisicao_itens: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          company_id: string
          created_at: string
          descricao: string
          id: string
          insumo_canonico_id: string | null
          motivo_cancelamento: string | null
          observacao: string | null
          orcamento_item_id: string | null
          ordem: number
          quantidade: number
          quantidade_atendida: number
          requisicao_id: string
          status: string
          unidade: string
          updated_at: string
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          company_id: string
          created_at?: string
          descricao: string
          id?: string
          insumo_canonico_id?: string | null
          motivo_cancelamento?: string | null
          observacao?: string | null
          orcamento_item_id?: string | null
          ordem?: number
          quantidade: number
          quantidade_atendida?: number
          requisicao_id: string
          status?: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          company_id?: string
          created_at?: string
          descricao?: string
          id?: string
          insumo_canonico_id?: string | null
          motivo_cancelamento?: string | null
          observacao?: string | null
          orcamento_item_id?: string | null
          ordem?: number
          quantidade?: number
          quantidade_atendida?: number
          requisicao_id?: string
          status?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisicao_itens_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicao_itens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicao_itens_insumo_canonico_id_fkey"
            columns: ["insumo_canonico_id"]
            isOneToOne: false
            referencedRelation: "insumos_canonicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicao_itens_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicao_itens_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "requisicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicao_itens_requisicao_id_fkey"
            columns: ["requisicao_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["requisicao_id"]
          },
        ]
      }
      requisicoes: {
        Row: {
          company_id: string
          created_at: string
          data_necessidade: string | null
          data_solicitacao: string
          descricao: string | null
          id: string
          numero: string
          obra_id: string | null
          observacao: string | null
          processo_id: string | null
          solicitante_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          data_necessidade?: string | null
          data_solicitacao?: string
          descricao?: string | null
          id?: string
          numero: string
          obra_id?: string | null
          observacao?: string | null
          processo_id?: string | null
          solicitante_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          data_necessidade?: string | null
          data_solicitacao?: string
          descricao?: string | null
          id?: string
          numero?: string
          obra_id?: string | null
          observacao?: string | null
          processo_id?: string | null
          solicitante_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requisicoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisicoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "vw_processo_cadeia"
            referencedColumns: ["processo_id"]
          },
          {
            foreignKeyName: "requisicoes_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sequencias: {
        Row: {
          company_id: string
          entidade: string
          valor: number
        }
        Insert: {
          company_id: string
          entidade: string
          valor?: number
        }
        Update: {
          company_id?: string
          entidade?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "sequencias_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sugestoes_ia: {
        Row: {
          company_id: string
          created_at: string
          descricao: string
          economia_estimada: number | null
          entidade: string | null
          entidade_id: string | null
          expira_em: string | null
          gerado_por: string
          hash_dedupe: string | null
          id: string
          motivo_rejeicao: string | null
          obra_id: string | null
          payload: Json
          resolvido_em: string | null
          resolvido_por: string | null
          severidade: string
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          company_id: string
          created_at?: string
          descricao: string
          economia_estimada?: number | null
          entidade?: string | null
          entidade_id?: string | null
          expira_em?: string | null
          gerado_por?: string
          hash_dedupe?: string | null
          id?: string
          motivo_rejeicao?: string | null
          obra_id?: string | null
          payload?: Json
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
          status?: string
          tipo: string
          titulo: string
        }
        Update: {
          company_id?: string
          created_at?: string
          descricao?: string
          economia_estimada?: number | null
          entidade?: string | null
          entidade_id?: string | null
          expira_em?: string | null
          gerado_por?: string
          hash_dedupe?: string | null
          id?: string
          motivo_rejeicao?: string | null
          obra_id?: string | null
          payload?: Json
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugestoes_ia_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugestoes_ia_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugestoes_ia_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_pagamento: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_pagamento_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          global_role: string
          id: string
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          global_role: string
          id: string
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          global_role?: string
          id?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_estoque_saldo: {
        Row: {
          company_id: string | null
          descricao: string | null
          insumo_canonico_id: string | null
          obra_id: string | null
          saldo: number | null
          ultimo_movimento: string | null
          unidade: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentos_insumo_canonico_id_fkey"
            columns: ["insumo_canonico_id"]
            isOneToOne: false
            referencedRelation: "insumos_canonicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_oc_recebimento: {
        Row: {
          company_id: string | null
          ordem_compra_id: string | null
          percentual_recebido: number | null
          qtd_pedida: number | null
          qtd_recebida: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_compra_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_preco_referencia: {
        Row: {
          amostras: number | null
          company_id: string | null
          desvio: number | null
          insumo_canonico_id: string | null
          maximo: number | null
          mediana: number | null
          minimo: number | null
          p25: number | null
          p75: number | null
          ultima_data: string | null
        }
        Relationships: [
          {
            foreignKeyName: "precos_historicos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_historicos_insumo_canonico_id_fkey"
            columns: ["insumo_canonico_id"]
            isOneToOne: false
            referencedRelation: "insumos_canonicos"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_processo_cadeia: {
        Row: {
          company_id: string | null
          cotacao_id: string | null
          cotacao_numero: number | null
          cotacao_status: string | null
          documento_numero: string | null
          lancamento_id: string | null
          lancamento_numero: string | null
          lancamento_status: string | null
          lancamento_valor: number | null
          numero_processo: string | null
          obra_id: string | null
          ordem_id: string | null
          ordem_numero: number | null
          ordem_status: string | null
          ordem_valor: number | null
          processo_id: string | null
          recebimento_id: string | null
          recebimento_seq: number | null
          requisicao_id: string | null
          requisicao_numero: string | null
          requisicao_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_compra_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_compra_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adicionar_itens_cotacao: {
        Args: { p_cotacao_id: string; p_item_ids: string[] }
        Returns: number
      }
      buscar_documento_semantico: {
        Args: {
          p_company: string
          p_embedding: string
          p_limite?: number
          p_obra?: string
        }
        Returns: {
          chunk_id: number
          conteudo: string
          documento_id: string
          documento_nome: string
          pagina: number
          similaridade: number
          tipo: string
        }[]
      }
      buscar_insumo_semantico: {
        Args: {
          p_company: string
          p_embedding: string
          p_limite?: number
          p_similaridade_min?: number
        }
        Returns: {
          categoria: string
          descricao: string
          id: string
          similaridade: number
          unidade: string
        }[]
      }
      can_write_company: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      cancelar_item_requisicao: {
        Args: { p_item_id: string; p_motivo: string }
        Returns: undefined
      }
      comprar_direto: {
        Args: {
          p_company: string
          p_documento_numero?: string
          p_documento_path?: string
          p_forma_pagamento?: string
          p_fornecedor_id: string
          p_item_ids: string[]
          p_ja_pago?: boolean
          p_ja_recebido?: boolean
          p_valores: Json
          p_vencimento?: string
        }
        Returns: string
      }
      confirmar_recebimento: {
        Args: {
          p_data?: string
          p_documento_numero?: string
          p_documento_path?: string
          p_documento_valor?: number
          p_gerar_lancamento?: boolean
          p_itens: Json
          p_observacao?: string
          p_ordem_id: string
          p_vencimento?: string
        }
        Returns: string
      }
      criar_processo: {
        Args: { p_company: string; p_obra?: string; p_origem?: string }
        Returns: string
      }
      explodir_composicao: {
        Args: { p_composicao_id: string; p_quantidade: number }
        Returns: {
          descricao: string
          insumo_canonico_id: string
          obrigatorio: boolean
          perda_percentual: number
          quantidade_bruta: number
          quantidade_total: number
          unidade: string
        }[]
      }
      gerar_cotacao_de_itens: {
        Args: {
          p_company: string
          p_data_limite?: string
          p_descricao?: string
          p_item_ids: string[]
        }
        Returns: string
      }
      gerar_ordens_da_cotacao: {
        Args: { p_cotacao_id: string }
        Returns: string[]
      }
      is_admin_global: { Args: never; Returns: boolean }
      my_company_ids: { Args: never; Returns: string[] }
      my_global_role: { Args: never; Returns: string }
      orcamento_company: { Args: { oid: string }; Returns: string }
      pode_ler: { Args: { p_company: string }; Returns: boolean }
      proximo_numero: {
        Args: { p_company: string; p_entidade: string }
        Returns: number
      }
      remover_item_cotacao: {
        Args: { p_cotacao_item_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      tem_modulo: {
        Args: { p_company: string; p_modulo: string }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
      unaccent_imut: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
