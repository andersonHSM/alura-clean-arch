# Documentação Swagger do NestJS

## Documentação da API com Swagger

Este projeto utiliza Swagger para fornecer documentação interativa da API. Siga estes passos para acessá-la:

1. Inicie a aplicação:
   ```bash
   npm run start:dev
   ```

2. Abra seu navegador e acesse a interface do Swagger em:
   ```
   http://localhost:3000/api
   ```

3. Você verá a documentação interativa completa de todos os endpoints da API.

## Recursos

A documentação Swagger oferece:

- Lista completa de todos os endpoints disponíveis
- Esquemas de requisição e resposta
- Capacidade de testar chamadas de API diretamente do navegador
- Integração com autenticação (quando configurada)

## Modificando a Documentação

Para adicionar ou modificar a documentação Swagger:

1. Use `@ApiTags()` para organizar controllers em grupos lógicos
2. Use `@ApiOperation()` para descrever cada endpoint
3. Use `@ApiResponse()` para documentar possíveis códigos de status de resposta
4. Use `@ApiProperty()` nos DTOs para documentar propriedades de requisição/resposta

Por exemplo:

```typescript
@ApiTags('produtos')
@Controller('produtos')
export class ProdutosController {
  @ApiOperation({ summary: 'Obter todos os produtos' })
  @ApiResponse({ status: 200, description: 'Lista de produtos retornada com sucesso' })
  @Get()
  findAll() {
    // Implementação
  }
}
```

Para mais informações, consulte a [documentação oficial do NestJS Swagger](https://docs.nestjs.com/openapi/introduction).
