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
          condicao_pagamento: string | null
          cotacao_id: string
          created_at: string
          fornecedor_id: string
          frete: number
          id: string
          observacao: string | null
        }
        Insert: {
          condicao_pagamento?: string | null
          cotacao_id: string
          created_at?: string
          fornecedor_id: string
          frete?: number
          id?: string
          observacao?: string | null
        }
        Update: {
          condicao_pagamento?: string | null
          cotacao_id?: string
          created_at?: string
          fornecedor_id?: string
          frete?: number
          id?: string
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacao_fornecedores_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
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
          cotacao_id: string
          descricao: string
          id: string
          orcamento_item_id: string | null
          ordem: number
          quantidade: number
          unidade: string | null
        }
        Insert: {
          cotacao_id: string
          descricao: string
          id?: string
          orcamento_item_id?: string | null
          ordem?: number
          quantidade?: number
          unidade?: string | null
        }
        Update: {
          cotacao_id?: string
          descricao?: string
          id?: string
          orcamento_item_id?: string | null
          ordem?: number
          quantidade?: number
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacao_itens_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacao_itens_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacao_precos: {
        Row: {
          cotacao_fornecedor_id: string
          cotacao_item_id: string
          escolhido: boolean
          id: string
          marca: string | null
          valor_unitario: number
        }
        Insert: {
          cotacao_fornecedor_id: string
          cotacao_item_id: string
          escolhido?: boolean
          id?: string
          marca?: string | null
          valor_unitario?: number
        }
        Update: {
          cotacao_fornecedor_id?: string
          cotacao_item_id?: string
          escolhido?: boolean
          id?: string
          marca?: string | null
          valor_unitario?: number
        }
        Relationships: [
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
          descricao: string | null
          id: string
          numero: number
          obra_id: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          numero: number
          obra_id?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          numero?: number
          obra_id?: string | null
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
          company_id: string
          created_at: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          id: string
          obra_id: string | null
          status: string
          titulo: string
          updated_at: string | null
          valor: number | null
          vencimento: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          obra_id?: string | null
          status?: string
          titulo: string
          updated_at?: string | null
          valor?: number | null
          vencimento?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          obra_id?: string | null
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
          descricao: string
          id: string
          marca: string | null
          orcamento_item_id: string | null
          ordem: number
          ordem_compra_id: string
          quantidade: number
          unidade: string | null
          valor_unitario: number
        }
        Insert: {
          descricao: string
          id?: string
          marca?: string | null
          orcamento_item_id?: string | null
          ordem?: number
          ordem_compra_id: string
          quantidade?: number
          unidade?: string | null
          valor_unitario?: number
        }
        Update: {
          descricao?: string
          id?: string
          marca?: string | null
          orcamento_item_id?: string | null
          ordem?: number
          ordem_compra_id?: string
          quantidade?: number
          unidade?: string | null
          valor_unitario?: number
        }
        Relationships: [
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
        ]
      }
      ordens_compra: {
        Row: {
          company_id: string
          condicao_pagamento: string
          cotacao_id: string | null
          created_at: string
          fornecedor_id: string | null
          frete: number
          id: string
          numero: number
          obra_id: string | null
          observacao: string | null
          previsao_entrega: string | null
          status: string
          valor: number
        }
        Insert: {
          company_id: string
          condicao_pagamento: string
          cotacao_id?: string | null
          created_at?: string
          fornecedor_id?: string | null
          frete?: number
          id?: string
          numero: number
          obra_id?: string | null
          observacao?: string | null
          previsao_entrega?: string | null
          status?: string
          valor?: number
        }
        Update: {
          company_id?: string
          condicao_pagamento?: string
          cotacao_id?: string | null
          created_at?: string
          fornecedor_id?: string | null
          frete?: number
          id?: string
          numero?: number
          obra_id?: string | null
          observacao?: string | null
          previsao_entrega?: string | null
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
    }
    Functions: {
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
      is_admin_global: { Args: never; Returns: boolean }
      my_company_ids: { Args: never; Returns: string[] }
      my_global_role: { Args: never; Returns: string }
      orcamento_company: { Args: { oid: string }; Returns: string }
      pode_ler: { Args: { p_company: string }; Returns: boolean }
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
