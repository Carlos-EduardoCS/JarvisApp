# Jarvis — primeira versão pessoal

Funcionalidades implementadas: tarefas e lembretes locais; listas Hoje, Próximas e Concluídas; temas claro, escuro e sistema com transição; abertura animada; menu com nome e foto locais; backup manual; endereço e link de reunião por tarefa. Pro é apenas uma opção futura.

## Endereços e reuniões

Na criação ou edição, os campos “Local ou endereço” e “Link da reunião” são opcionais. Informe um endereço completo, com cidade, e cole apenas o link da reunião.

“Abrir no mapa” abre uma busca no Apple Maps. Confira o destino antes de iniciar a rota. Não é necessário dar ao Jarvis acesso à sua localização.

“Entrar na reunião” abre o link no aplicativo ou navegador escolhido pelo iPhone. A instalação do serviço, autenticação e permissões de entrada na reunião dependem do serviço externo. O Jarvis não cria reuniões.

Os campos acompanham o backup manual. Backups antigos continuam aceitos. Na importação, tarefas já existentes são preservadas, inclusive seus endereços e links atuais.

## Conferência no iPhone

1. Crie uma tarefa com endereço completo e um link real de reunião.
2. Toque nos dois botões e confira o destino e a reunião abertos.
3. Edite os campos, salve e confira as alterações.
4. Limpe os campos e confira que os botões desaparecem.
5. Reabra o app e confira que as tarefas continuam salvas.
6. Exporte um backup e teste a recuperação com uma tarefa de teste.

Verificação automatizada: TypeScript e 11 testes de links, endereços e backup. A execução em aparelho real depende do teste acima. Esta entrega é o protótipo pessoal executado pelo Expo Go, não uma publicação na App Store.

Próxima etapa combinada: ajustes de estilo, após validar estas últimas funções no aparelho.
