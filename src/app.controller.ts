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

// --- DTOs (Data Transfer Objects) ---
// Todos os DTOs foram movidos para este arquivo.

export class CriarProdutoDto {
  @IsString() @IsNotEmpty() public nome: string;
  @IsNumber() @Min(0.01) preco: number;
  @IsNumber() @Min(0) estoque: number;
}

export class AtualizarProdutoDto {
  @IsOptional() @IsString() @IsNotEmpty() nome?: string;
  @IsOptional() @IsNumber() @Min(0.01) preco?: number;
  @IsOptional() @IsNumber() @Min(0) estoque?: number;
}

export class AdicionarItemDto {
  @IsString() @IsNotEmpty() produtoId: string;

  @IsNumber()
  @Min(1, { message: 'A quantidade deve ser de no mínimo 1.' })
  quantidade: number;
}

@Controller()
export class AppController {
  // Instanciação direta do PrismaClient.
  private readonly prisma = new PrismaClient();
  // ID do usuário fixo para simulação do carrinho.
  private readonly usuarioId = 'usuario-123';

  constructor() {}

  // --- MÉTODOS DO CONTROLLER DE PRODUTOS ---

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

  @Get('produtos') async listarTodos() {
    return this.prisma.produto.findMany();
  }

  @Get('produtos/:id') async buscarProdutoPorId(@Param('id') id: string) {
    const produto = await this.prisma.produto.findUnique({ where: { id } });
    if (!produto) {
      throw new NotFoundException(`Produto com ID ${id} não encontrado.`);
    }
    return produto;
  }

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

  @Delete('produtos/:id') @HttpCode(204) async removerProduto(
    @Param('id') id: string,
  ) {
    await this.buscarProdutoPorId(id);
    await this.prisma.produto.delete({ where: { id } });
  }

  // --- MÉTODOS DO CONTROLLER DE CARRINHO ---

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

  @Get('carrinho') async verCarrinho() {
    const carrinho = await this.obterOuCriarCarrinho();
    return this.formatarCarrinho(carrinho);
  }

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
