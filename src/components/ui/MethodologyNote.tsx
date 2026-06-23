export default function MethodologyNote() {
  return (
    <details className="bg-white dark:bg-slate-800 rounded-card border border-gray-100 dark:border-slate-700 shadow-card group">
      <summary className="px-3 py-2 cursor-pointer text-[0.7rem] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300 hover:text-anac-blue dark:hover:text-blue-400 flex items-center gap-2 select-none">
        <span className="text-slate-400 dark:text-slate-500 group-open:rotate-90 transition-transform inline-block">▶</span>
        Metodologia e notas
      </summary>
      <div className="px-3 pb-3 pt-1 text-[0.75rem] text-slate-600 dark:text-slate-300 leading-relaxed space-y-3 border-t border-gray-100 dark:border-slate-700">
        <section>
          <h4 className="font-bold text-slate-700 dark:text-slate-100 mb-1">O que entra no painel</h4>
          <p>
            O painel considera voos domésticos regulares de passageiros operados em aeroportos
            brasileiros. Voos internacionais, cargueiros e fretados ficam fora da análise.
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 dark:text-slate-100 mb-1">Passageiros e empresas</h4>
          <p>
            A participação de cada empresa é calculada pelo número de passageiros pagos no
            aeroporto e no período selecionados. Por isso, rankings e percentuais mudam quando
            você troca o aeroporto ou ajusta os anos.
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 dark:text-slate-100 mb-1">Atrasos e pontualidade</h4>
          <p>
            Um voo é contado como atrasado quando parte 30 minutos ou mais depois do horário
            programado. A pontualidade mostra a fatia complementar: voos que partiram no horário
            ou com atraso inferior a 30 minutos.
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 dark:text-slate-100 mb-1">Frota e certificados</h4>
          <p>
            A frota vem do Registro Aeronáutico Brasileiro, mantido pela ANAC. O indicador de
            certificado em dia mostra aeronaves com Certificado de Aeronavegabilidade válido no
            registro público. Ele não mede manutenção realizada, apenas a situação cadastral do
            certificado.
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 dark:text-slate-100 mb-1">Segurança e manutenção</h4>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              <strong>Falhas reportadas:</strong> relatos técnicos enviados por operadores sobre
              dificuldades em serviço. Eles ajudam a identificar sistemas de aeronave que aparecem
              com maior frequência nos registros.
            </li>
            <li>
              <strong>Ocorrências investigadas:</strong> acidentes e incidentes registrados pelo CENIPA,
              o Centro de Investigação e Prevenção de Acidentes Aeronáuticos.
            </li>
            <li>
              <strong>Regras obrigatórias:</strong> exigências da ANAC que determinam inspeção,
              correção ou acompanhamento técnico em aeronaves, motores ou componentes.
            </li>
          </ul>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 dark:text-slate-100 mb-1">Fontes e período</h4>
          <p>
            Os dados vêm dos dados públicos abertos da ANAC e cobrem 2000–2026, com 2026 ainda
            parcial. Eventos contextuais aparecem em alguns gráficos, como COVID-19 e enchentes
            no Rio Grande do Sul, quando ajudam a explicar mudanças no aeroporto selecionado.
          </p>
          <p className="mt-1">
            Fonte:{" "}
            <a
              className="text-anac-blue dark:text-blue-400 underline"
              href="https://sistemas.anac.gov.br/dadosabertos/"
              target="_blank"
              rel="noopener noreferrer"
            >
              dados públicos da ANAC
            </a>
            .
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 dark:text-slate-100 mb-1">Como ler com cuidado</h4>
          <p>
            Alguns indicadores têm escopos diferentes: passageiros, atrasos e participação são do
            aeroporto escolhido; frota e certificados são dados nacionais por empresa; ocorrências
            de segurança podem incluir aviação geral, não apenas operações comerciais regulares.
          </p>
        </section>
      </div>
    </details>
  );
}
