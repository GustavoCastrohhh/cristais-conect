export interface ReportData {
  id: string;
  contato: string;
  telefone: string;
  status: 'Enviado' | 'Falha' | 'Pendente';
  dataEnvio: Date;
}

export async function getReportData(): Promise<ReportData[]> {
  await new Promise(resolve => setTimeout(resolve, 500));

  return [
    {
      id: '1',
      contato: 'João Silva',
      telefone: '+55 11 98765-4321',
      status: 'Enviado',
      dataEnvio: new Date('2025-10-23T10:30:00'),
    },
    {
      id: '2',
      contato: 'Maria Santos',
      telefone: '+55 11 91234-5678',
      status: 'Enviado',
      dataEnvio: new Date('2025-10-23T10:31:00'),
    },
    {
      id: '3',
      contato: 'Pedro Oliveira',
      telefone: '+55 11 99876-5432',
      status: 'Falha',
      dataEnvio: new Date('2025-10-23T10:32:00'),
    },
    {
      id: '4',
      contato: 'Ana Costa',
      telefone: '+55 11 97654-3210',
      status: 'Enviado',
      dataEnvio: new Date('2025-10-23T10:33:00'),
    },
    {
      id: '5',
      contato: 'Carlos Souza',
      telefone: '+55 11 96543-2109',
      status: 'Pendente',
      dataEnvio: new Date('2025-10-23T10:34:00'),
    },
    {
      id: '6',
      contato: 'Juliana Lima',
      telefone: '+55 11 95432-1098',
      status: 'Enviado',
      dataEnvio: new Date('2025-10-23T10:35:00'),
    },
    {
      id: '7',
      contato: 'Roberto Alves',
      telefone: '+55 11 94321-0987',
      status: 'Enviado',
      dataEnvio: new Date('2025-10-23T10:36:00'),
    },
    {
      id: '8',
      contato: 'Fernanda Rocha',
      telefone: '+55 11 93210-9876',
      status: 'Falha',
      dataEnvio: new Date('2025-10-23T10:37:00'),
    },
    {
      id: '9',
      contato: 'Ricardo Mendes',
      telefone: '+55 11 92109-8765',
      status: 'Enviado',
      dataEnvio: new Date('2025-10-23T10:38:00'),
    },
    {
      id: '10',
      contato: 'Patrícia Ferreira',
      telefone: '+55 11 91098-7654',
      status: 'Enviado',
      dataEnvio: new Date('2025-10-23T10:39:00'),
    },
    {
      id: '11',
      contato: 'Lucas Martins',
      telefone: '+55 11 90987-6543',
      status: 'Pendente',
      dataEnvio: new Date('2025-10-23T10:40:00'),
    },
    {
      id: '12',
      contato: 'Beatriz Campos',
      telefone: '+55 11 99876-5432',
      status: 'Enviado',
      dataEnvio: new Date('2025-10-23T10:41:00'),
    },
    {
      id: '13',
      contato: 'André Barbosa',
      telefone: '+55 11 98765-4321',
      status: 'Enviado',
      dataEnvio: new Date('2025-10-23T10:42:00'),
    },
    {
      id: '14',
      contato: 'Camila Rodrigues',
      telefone: '+55 11 97654-3210',
      status: 'Falha',
      dataEnvio: new Date('2025-10-23T10:43:00'),
    },
    {
      id: '15',
      contato: 'Felipe Araújo',
      telefone: '+55 11 96543-2109',
      status: 'Enviado',
      dataEnvio: new Date('2025-10-23T10:44:00'),
    },
  ];
}
