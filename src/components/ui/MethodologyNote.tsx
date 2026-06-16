export default function MethodologyNote() {
  return (
    <details className="bg-white rounded-card border border-gray-100 shadow-card group">
      <summary className="px-3 py-2 cursor-pointer text-[0.7rem] font-bold uppercase tracking-[0.14em] text-slate-600 hover:text-anac-blue flex items-center gap-2 select-none">
        <span className="text-slate-400 group-open:rotate-90 transition-transform inline-block">▶</span>
        ℹ Metodologia &amp; notas
      </summary>
      <div className="px-3 pb-3 pt-1 text-[0.75rem] text-slate-600 leading-relaxed space-y-3 border-t border-gray-100">
        <section>
          <h4 className="font-bold text-slate-700 mb-1">Escopo</h4>
          <p>
            Aviação doméstica regular. Excluídos voos charter, cargueiros e
            internacionais. Base populacional: aeroportos brasileiros com voos
            regulares de passageiros pagos.
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 mb-1">Atraso</h4>
          <p>
            Diferença ≥ 30 minutos entre partida programada e partida real
            (block-off). Métrica oficial da ANAC. Calculada por par
            aeroporto-empresa-mês.
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 mb-1">Market share</h4>
          <p>
            Calculado por número de <em>passageiros pagos transportados</em> no
            aeroporto selecionado, no período filtrado. Não considera ASK ou
            decolagens.
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 mb-1">Três escopos de pontualidade</h4>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Pontualidade no aeroporto:</strong> média de todas as cias operando no aeroporto.</li>
            <li><strong>Pontualidade da cia neste aeroporto:</strong> da cia, mas filtrada por aeroporto.</li>
            <li>
              <strong>Idade da frota / Frota nacional:</strong> tamanho total da frota da cia (Brasil) e idade média.
              Cruza-se com pontualidade local na seção &quot;Frota&quot;.
            </li>
          </ul>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 mb-1">Certificado de Aeronavegabilidade (CA)</h4>
          <p className="mb-1">
            Métrica de conformidade derivada do <strong>DT_VALIDADE_CA</strong> do RAB. Classificação:
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>Vigente:</strong> data de validade ≥ data do snapshot (2026-05-26).</li>
            <li><strong>Vencido:</strong> data de validade &lt; data do snapshot.</li>
            <li>
              <strong>Indefinido:</strong> campo preenchido com marcadores não-temporais
              (<code className="font-mono mx-0.5 text-[0.7rem] bg-slate-100 px-1 rounded">ABORDO</code>,
              <code className="font-mono mx-0.5 text-[0.7rem] bg-slate-100 px-1 rounded">RESRAB</code>,
              <code className="font-mono mx-0.5 text-[0.7rem] bg-slate-100 px-1 rounded">ISENTA</code>)
              ou sem data parseável.
            </li>
          </ul>
          <p className="mt-1">
            <em>Limitação:</em> &quot;% CA vigente&quot; é um <strong>limite inferior</strong> — aeronaves com
            certificado fisicamente a bordo (<code className="font-mono mx-0.5 text-[0.7rem] bg-slate-100 px-1 rounded">ABORDO</code>)
            podem estar regulares mas não entram no numerador por falta de data no registro público. Por isso a
            métrica nacional total (44%) é menor que a de transporte (75%): aviação geral usa muito o marcador
            <code className="font-mono mx-0.5 text-[0.7rem] bg-slate-100 px-1 rounded">ABORDO</code>.
            Não é registro de manutenção realizada — só sinaliza status do certificado. Manutenção em si é
            interna ao PMOP/PSAB do operador e não publicada pela ANAC.
          </p>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 mb-1">Segurança operacional &amp; manutenção</h4>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              <strong>SDR (Service Difficulty Reports):</strong> ocorrências de dificuldades em serviço
              reportadas por operadores. V2 (atual, 2017+) + Histórico (com código ATA). Indica quais
              <em> componentes</em> falham mais. Capítulo ATA = sistema da aeronave (ex: 32 trem de pouso, 72 motor).
            </li>
            <li>
              <strong>Ocorrências (CENIPA):</strong> acidentes + incidentes + incidentes graves investigados
              pelo Centro de Investigação e Prevenção de Acidentes Aeronáuticos.
              Inclui aviação geral (não só comercial), por isso o número é alto.
            </li>
            <li>
              <strong>Diretrizes de Aeronavegabilidade (ADs):</strong> ordens regulatórias obrigatórias da ANAC
              quando um defeito é identificado num modelo. &quot;Vigente&quot; = status ≠ <code className="font-mono mx-0.5 text-[0.7rem] bg-slate-100 px-1 rounded">C</code> (cancelada) /
              <code className="font-mono mx-0.5 text-[0.7rem] bg-slate-100 px-1 rounded">R</code> (revogada) /
              <code className="font-mono mx-0.5 text-[0.7rem] bg-slate-100 px-1 rounded">S</code> (substituída).
            </li>
          </ul>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 mb-1">Fontes</h4>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>VRA</strong> — Voo Regular Ativo: movimento mensal e atrasos por par origem/destino.</li>
            <li><strong>RAB</strong> — Registro Aeronáutico Brasileiro: cadastro de aeronaves ativas (idade, fabricante, operador).</li>
            <li><strong>Dados públicos abertos</strong> — <a className="text-anac-blue underline" href="https://sistemas.anac.gov.br/dadosabertos/" target="_blank" rel="noopener noreferrer">sistemas.anac.gov.br/dadosabertos</a>.</li>
          </ul>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 mb-1">Período disponível</h4>
          <p>2000–2026 (parcial em 2026). Eventos contextuais marcados: COVID-19 (2020-03 a 2021-09) e Enchentes RS (2024-05 a 2025-01) afetam SBPA/SBCX/SBNF.</p>
        </section>

        <section>
          <h4 className="font-bold text-slate-700 mb-1">Reprodutibilidade</h4>
          <p>
            Trabalho de mestrado PPGC/UFRGS. O dashboard usa JSONs consolidados
            em <code className="font-mono mx-1 text-[0.7rem] bg-slate-100 px-1 py-0.5 rounded">public/data/</code>
            e executa as agregações no navegador.
          </p>
        </section>
      </div>
    </details>
  );
}
