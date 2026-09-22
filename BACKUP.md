# Backup manual do Jarvis

No topo do app, toque em **Backup**.

## Exportar

Toque em **Exportar backup**. Na tela de compartilhamento do iPhone, escolha **Salvar em Arquivos**, selecione uma pasta (por exemplo, iCloud Drive) e confirme. Confira se o arquivo `Jarvis-backup-…json` está nessa pasta. Fechar a tela de compartilhamento não significa que o arquivo foi salvo.

O arquivo contém tarefas e preferência de tema em texto legível. Não há envio automático a um servidor. O iCloud Drive, se escolhido, cuida da sincronização do arquivo de acordo com sua conta e conexão.

Os campos opcionais de endereço e link da reunião também são incluídos. Backups antigos, sem esses campos, continuam compatíveis. Nome e foto do perfil permanecem locais e não fazem parte deste formato de backup.

## Restaurar

Toque em **Restaurar backup**, selecione o arquivo e confira a data, a quantidade de tarefas novas e o tema antes de confirmar.

- Tarefas ausentes são adicionadas.
- Tarefas com o mesmo identificador são mantidas como estão no aparelho; o backup não desfaz edições atuais.
- Nenhuma tarefa atual é apagada, mesmo se o backup estiver vazio.
- O tema do backup é aplicado.
- Somente tarefas novas, não concluídas e com horário de aviso futuro são candidatas ao reagendamento.
- Avisos não agendados por falta de permissão, limite do aparelho ou falha são informados ao final. Corrija a permissão e edite/salve a tarefa para tentar novamente.

O arquivo precisa ser um backup Jarvis versão 1, com até 5 MB e 10.000 tarefas. Arquivos inválidos são rejeitados antes de alterar seus dados.

## Verificações realizadas

TypeScript, empacotamento JavaScript iOS e seis testes de validação/restauração. Para executar os testes com Node recente: `node --experimental-strip-types --test src/backup.test.mjs`.

## Teste no iPhone

1. Crie uma tarefa, exporte e confirme o arquivo no app Arquivos.
2. Cancele uma importação e confira que as tarefas continuam iguais.
3. Restaure o arquivo duas vezes e confira que não surgem duplicatas.
4. Para testar recuperação, use uma tarefa de teste, confirme que ela está no backup e exclua-a do Jarvis; importe o backup e confira seu retorno.
5. Se a tarefa recuperada tiver aviso futuro, verifique a notificação no horário.

O seletor, compartilhamento e entrega real de notificações ainda precisam ser testados no aparelho.
