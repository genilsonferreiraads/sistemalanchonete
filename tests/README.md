# Testes automatizados

Na pasta principal do projeto, execute com Node.js, sem instalar dependências:

```sh
node --test tests/*.test.cjs
```

Os testes cobrem o suprimento de R$ 300, excedente e falta de dinheiro,
campos opcionais, somas exatas em centavos, entradas inválidas, atualização
da interface, retomada do foco e impressão separada de cartão/Pix e fechamento.
Também verificam 5.000 cenários de soma e as 64 combinações de campos de
notas e moedas preenchidos ou vazios.
