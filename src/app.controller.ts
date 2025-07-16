import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Carrinho, PrismaClient } from '@prisma/client';
import { ApiProperty, ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';

// --- DTOs (Data Transfer Objects) ---
// Todos os DTOs foram movidos para este arquivo.

export class CriarProdutoDto {
  @ApiProperty({
    description: 'Nome do produto',
    example: 'Smartphone XYZ'
  })
  @IsString() @IsNotEmpty() public nome: string;

  @ApiProperty({
    description: 'Preço do produto',
    example: 1299.99,
    minimum: 0.01
  })
  @IsNumber() @Min(0.01) preco: number;

  @ApiProperty({
    description: 'Quantidade em estoque',
    example: 50,
    minimum: 0
  })
  @IsNumber() @Min(0) estoque: number;
}

export class AtualizarProdutoDto {
  @ApiProperty({
    description: 'Nome do produto',
    example: 'Smartphone XYZ',
    required: false
  })
  @IsOptional() @IsString() @IsNotEmpty() nome?: string;

  @ApiProperty({
    description: 'Preço do produto',
    example: 1299.99,
    minimum: 0.01,
    required: false
  })
  @IsOptional() @IsNumber() @Min(0.01) preco?: number;

  @ApiProperty({
    description: 'Quantidade em estoque',
    example: 50,
    minimum: 0,
    required: false
  })
  @IsOptional() @IsNumber() @Min(0) estoque?: number;
}

export class AdicionarItemDto {
  @ApiProperty({
    description: 'ID do produto',
    example: 'c7d8e9f0-1a2b-3c4d-5e6f-7g8h9i0j1k2l'
  })
  @IsString() @IsNotEmpty() produtoId: string;

  @ApiProperty({
    description: 'Quantidade do produto',
    example: 1,
    minimum: 1
  })
  @IsNumber()
  @Min(1, { message: 'A quantidade deve ser de no mínimo 1.' })
  quantidade: number;
}

@ApiTags('produtos', 'carrinho')
@Controller()
export class AppController {
  // Instanciação direta do PrismaClient.
  private readonly prisma = new PrismaClient();
  // ID do usuário fixo para simulação do carrinho.
  private readonly usuarioId = 'usuario-123';

  constructor() {}

  // --- MÉTODOS DO CONTROLLER DE PRODUTOS ---

  @ApiOperation({ summary: 'Criar um novo produto' })
  @ApiResponse({ 
    status: 201, 
    description: 'Produto criado com sucesso'
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Já existe um produto com este nome' 
  })
  @Post('produtos') async criarProduto(
    @Body() dadosDoProduto: CriarProdutoDto,
  ) {
    const produtoExistente = await this.prisma.produto.findUnique({
      where: { nome: dadosDoProduto.nome },
    });

    if (produtoExistente) {
      throw new ConflictException('Já existe um produto com este nome.');
    }

    const produto = await this.prisma.produto.create({
      data: dadosDoProduto,
    });

    return { mensagem: 'Produto criado com sucesso!', produto };
  }

  @ApiOperation({ summary: 'Listar todos os produtos' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de produtos retornada com sucesso'
  })
  @Get('produtos') async listarTodos() {
    return this.prisma.produto.findMany();
  }

  @ApiOperation({ summary: 'Obter um produto específico' })
  @ApiParam({ name: 'id', description: 'ID do produto' })
  @ApiResponse({ 
    status: 200, 
    description: 'Produto encontrado'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Produto não encontrado' 
  })
  @Get('produtos/:id') async buscarProdutoPorId(@Param('id') id: string) {
    const produto = await this.prisma.produto.findUnique({ where: { id } });
    if (!produto) {
      throw new NotFoundException(`Produto com ID ${id} não encontrado.`);
    }
    return produto;
  }

  @ApiOperation({ summary: 'Atualizar um produto existente' })
  @ApiParam({ name: 'id', description: 'ID do produto' })
  @ApiResponse({ 
    status: 200, 
    description: 'Produto atualizado com sucesso'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Produto não encontrado' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Dados inválidos para atualização' 
  })
  @Put('produtos/:id') async atualizarProduto(
    @Param('id') id: string,
    @Body() dadosParaAtualizar: AtualizarProdutoDto,
  ) {
    await this.buscarProdutoPorId(id);

    if (Object.keys(dadosParaAtualizar).length === 0) {
      throw new BadRequestException(
        'Pelo menos um campo deve ser fornecido para atualização.',
      );
    }

    const produtoAtualizado = await this.prisma.produto.update({
      where: { id },
      data: dadosParaAtualizar,
    });

    return { mensagem: 'Produto atualizado!', produto: produtoAtualizado };
  }

  @ApiOperation({ summary: 'Remover um produto' })
  @ApiParam({ name: 'id', description: 'ID do produto' })
  @ApiResponse({ 
    status: 204, 
    description: 'Produto removido com sucesso' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Produto não encontrado' 
  })
  @Delete('produtos/:id') @HttpCode(204) async removerProduto(
    @Param('id') id: string,
  ) {
    await this.buscarProdutoPorId(id);
    await this.prisma.produto.delete({ where: { id } });
  }

  // --- MÉTODOS DO CONTROLLER DE CARRINHO ---

  @ApiOperation({ summary: 'Adicionar item ao carrinho' })
  @ApiResponse({ 
    status: 200, 
    description: 'Item adicionado ao carrinho com sucesso' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Produto não encontrado' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Estoque insuficiente' 
  })
  @Post('carrinho/adicionar') async adicionarItem(
    @Body() itemDto: AdicionarItemDto,
  ) {
    const carrinho = await this.obterOuCriarCarrinho();

    const produto = await this.prisma.produto.findUnique({
      where: { id: itemDto.produtoId },
    });
    if (!produto) {
      throw new NotFoundException(
        `Produto com ID ${itemDto.produtoId} não encontrado.`,
      );
    }

    if (produto.estoque < itemDto.quantidade) {
      throw new BadRequestException(
        `Estoque insuficiente para "${produto.nome}". Disponível: ${produto.estoque}.`,
      );
    }

    const [_, carrinhoAtualizado] = await this.prisma.$transaction([
      this.prisma.produto.update({
        where: { id: itemDto.produtoId },
        data: { estoque: { decrement: itemDto.quantidade } },
      }),
      this.prisma.carrinho.update({
        where: { id: carrinho.id },
        data: {
          itens: {
            upsert: {
              where: {
                produtoId_carrinhoId: {
                  produtoId: itemDto.produtoId,
                  carrinhoId: carrinho.id,
                },
              },
              create: {
                produtoId: itemDto.produtoId,
                quantidade: itemDto.quantidade,
              },
              update: { quantidade: { increment: itemDto.quantidade } },
            },
          },
        },
        include: { itens: { include: { produto: true } } },
      }),
    ]);

    return {
      mensagem: 'Item adicionado ao carrinho!',
      carrinho: this.formatarCarrinho(carrinhoAtualizado),
    };
  }

  @ApiOperation({ summary: 'Ver carrinho atual' })
  @ApiResponse({ 
    status: 200, 
    description: 'Carrinho retornado com sucesso' 
  })
  @Get('carrinho') async verCarrinho() {
    const carrinho = await this.obterOuCriarCarrinho();
    return this.formatarCarrinho(carrinho);
  }

  @ApiOperation({ summary: 'Remover item do carrinho' })
  @ApiParam({ name: 'produtoId', description: 'ID do produto a ser removido' })
  @ApiResponse({ 
    status: 200, 
    description: 'Item removido do carrinho com sucesso' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Produto não está no carrinho' 
  })
  @Delete('carrinho/remover/:produtoId') async removerItem(
    @Param('produtoId') produtoId: string,
  ) {
    const carrinho = await this.obterOuCriarCarrinho();
    const itemNoCarrinho = carrinho.itens.find(
      (i) => i.produtoId === produtoId,
    );

    if (!itemNoCarrinho) {
      throw new NotFoundException(
        `Produto com ID ${produtoId} não está no carrinho.`,
      );
    }

    const [_, carrinhoAtualizado] = await this.prisma.$transaction([
      this.prisma.produto.update({
        where: { id: produtoId },
        data: { estoque: { increment: itemNoCarrinho.quantidade } },
      }),
      this.prisma.carrinho.update({
        where: { id: carrinho.id },
        data: {
          itens: {
            delete: { id: itemNoCarrinho.id },
          },
        },
        include: { itens: { include: { produto: true } } },
      }),
    ]);

    return {
      mensagem: 'Item removido do carrinho!',
      carrinho: this.formatarCarrinho(carrinhoAtualizado),
    };
  }

  // --- MÉTODOS PRIVADOS AUXILIARES ---

  private async obterOuCriarCarrinho() {
    let carrinho = await this.prisma.carrinho.findUnique({
      where: { usuarioId: this.usuarioId },
      include: { itens: { include: { produto: true } } },
    });

    if (!carrinho) {
      carrinho = await this.prisma.carrinho.create({
        data: { usuarioId: this.usuarioId },
        include: { itens: { include: { produto: true } } },
      });
    }
    return carrinho;
  }

  private formatarCarrinho(
    carrinho: Awaited<ReturnType<typeof this.obterOuCriarCarrinho>>,
  ) {
    const total = carrinho.itens.reduce((acc, item) => {
      return acc + item.quantidade * item.produto.preco;
    }, 0);

    return {
      id: carrinho.id,
      usuarioId: carrinho.usuarioId,
      itens: carrinho.itens.map((i) => ({
        produtoId: i.produtoId,
        nome: i.produto.nome,
        quantidade: i.quantidade,
        precoUnitario: i.produto.preco,
        totalItem: i.quantidade * i.produto.preco,
      })),
      total: total,
    };
  }
}
