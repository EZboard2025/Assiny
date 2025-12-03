/**
 * Lista de nomes masculinos brasileiros para clientes virtuais em roleplays
 */
const maleClientNames = [
  'Carlos',
  'Roberto',
  'Rafael',
  'Marcelo',
  'André',
  'Fernando',
  'Ricardo',
  'Paulo',
  'Eduardo',
  'Gustavo',
  'Felipe',
  'Bruno',
  'Diego',
  'Lucas',
  'Thiago',
  'Rodrigo',
  'Vinicius',
  'Leonardo',
  'Daniel',
  'Pedro',
  'João',
  'Marcos',
  'Alexandre',
  'Renato',
  'Fábio',
  'Guilherme',
  'Henrique',
  'Mateus',
  'Gabriel',
  'Igor',
  'Caio',
  'Leandro',
  'Sérgio',
  'Maurício',
  'César',
  'Júlio',
  'Anderson',
  'William',
  'Douglas',
  'Murilo',
  'Vinícius',
  'Samuel',
  'Hugo',
  'Otávio',
  'Raul',
  'Victor',
  'Renan',
  'Cristiano',
  'Adriano',
  'Márcio'
]

/**
 * Retorna um nome masculino aleatório da lista
 * Usado para gerar nomes de clientes virtuais em roleplays
 */
export function getRandomMaleClientName(): string {
  const randomIndex = Math.floor(Math.random() * maleClientNames.length)
  return maleClientNames[randomIndex]
}
