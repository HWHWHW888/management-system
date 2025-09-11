import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { User, Customer, Transaction } from '../types';
import { Plus, Calendar, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface TransactionManagementProps {
  user: User;
}

const gameTypes = ['Baccarat', 'Blackjack', 'Poker', 'Roulette', 'Slots', 'Other'];

export function TransactionManagement({ user }: TransactionManagementProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState({
    customerId: '',
    date: new Date().toISOString().split('T')[0],
    rollingAmount: 0,
    winLoss: 0,
    gameType: '',
    notes: ''
  });

  useEffect(() => {
    const savedTransactions = localStorage.getItem('casinoTransactions');
    const savedCustomers = localStorage.getItem('casinoCustomers');
    
    if (savedTransactions) {
      setTransactions(JSON.parse(savedTransactions));
    }
    if (savedCustomers) {
      setCustomers(JSON.parse(savedCustomers));
    }
  }, []);

  // Filter data based on user role
  const getFilteredData = () => {
    let filteredTransactions = transactions;
    let filteredCustomers = customers;

    if (user.role === 'agent' && user.agentId) {
      filteredTransactions = transactions.filter(t => t.agentId === user.agentId);
      filteredCustomers = customers.filter(c => c.agentId === user.agentId);
    }

    return { filteredTransactions, filteredCustomers };
  };

  const { filteredTransactions, filteredCustomers } = getFilteredData();

  const saveTransactions = (updatedTransactions: Transaction[]) => {
    setTransactions(updatedTransactions);
    localStorage.setItem('casinoTransactions', JSON.stringify(updatedTransactions));
    
    // Update customer totals
    updateCustomerTotals(updatedTransactions);
  };

  const updateCustomerTotals = (allTransactions: Transaction[]) => {
    const updatedCustomers = customers.map(customer => {
      const customerTransactions = allTransactions.filter(t => t.customerId === customer.id);
      const totalRolling = customerTransactions.reduce((sum, t) => sum + t.rollingAmount, 0);
      const totalWinLoss = customerTransactions.reduce((sum, t) => sum + t.winLoss, 0);
      
      return {
        ...customer,
        totalRolling,
        totalWinLoss
      };
    });
    
    setCustomers(updatedCustomers);
    localStorage.setItem('casinoCustomers', JSON.stringify(updatedCustomers));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedCustomer = customers.find(customer => customer.id === formData.customerId);
    if (!selectedCustomer) return;

    if (editingTransaction) {
      // Update existing transaction
      const updatedTransactions = transactions.map(transaction =>
        transaction.id === editingTransaction.id
          ? { 
              ...transaction, 
              ...formData,
              customerName: selectedCustomer.name,
              agentId: selectedCustomer.agentId,
              agentName: selectedCustomer.agentName
            }
          : transaction
      );
      saveTransactions(updatedTransactions);
    } else {
      // Add new transaction
      const newTransaction: Transaction = {
        id: `txn_${Date.now()}`,
        ...formData,
        customerName: selectedCustomer.name,
        agentId: selectedCustomer.agentId,
        agentName: selectedCustomer.agentName
      };
      saveTransactions([...transactions, newTransaction]);
    }

    setFormData({
      customerId: '',
      date: new Date().toISOString().split('T')[0],
      rollingAmount: 0,
      winLoss: 0,
      gameType: '',
      notes: ''
    });
    setEditingTransaction(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      customerId: transaction.customerId,
      date: transaction.date,
      rollingAmount: transaction.rollingAmount,
      winLoss: transaction.winLoss,
      gameType: transaction.gameType,
      notes: transaction.notes || ''
    });
    setIsDialogOpen(true);
  };

  const deleteTransaction = (transactionId: string) => {
    const updatedTransactions = transactions.filter(t => t.id !== transactionId);
    saveTransactions(updatedTransactions);
  };

  const openNewTransactionDialog = () => {
    setEditingTransaction(null);
    setFormData({
      customerId: '',
      date: new Date().toISOString().split('T')[0],
      rollingAmount: 0,
      winLoss: 0,
      gameType: '',
      notes: ''
    });
    setIsDialogOpen(true);
  };

  // Sort transactions by date (newest first)
  const sortedTransactions = filteredTransactions.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Transaction Management</h2>
          <p className="text-gray-600">
            {user.role === 'agent' ? 'Record gaming activity for your customers' : 'View and manage all gaming transactions'}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewTransactionDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}
              </DialogTitle>
              <DialogDescription>
                {editingTransaction ? 'Update transaction details' : 'Record a new gaming session'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="customer">Customer</Label>
                <Select 
                  value={formData.customerId} 
                  onValueChange={(value) => setFormData({...formData, customerId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCustomers.filter(c => c.isActive).map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="gameType">Game Type</Label>
                <Select 
                  value={formData.gameType} 
                  onValueChange={(value) => setFormData({...formData, gameType: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select game type" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameTypes.map((game) => (
                      <SelectItem key={game} value={game}>
                        {game}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="rolling">Rolling Amount ($)</Label>
                <Input
                  id="rolling"
                  type="number"
                  min="0"
                  step="100"
                  value={formData.rollingAmount}
                  onChange={(e) => setFormData({...formData, rollingAmount: parseFloat(e.target.value)})}
                  placeholder="0"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="winloss">Win/Loss Amount ($)</Label>
                <Input
                  id="winloss"
                  type="number"
                  step="10"
                  value={formData.winLoss}
                  onChange={(e) => setFormData({...formData, winLoss: parseFloat(e.target.value)})}
                  placeholder="0 (positive for customer win, negative for loss)"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Positive = Customer wins, Negative = House wins
                </p>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes about this session"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTransaction ? 'Update' : 'Add'} Transaction
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {sortedTransactions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500">No transactions found. Add your first transaction to get started.</p>
            </CardContent>
          </Card>
        ) : (
          sortedTransactions.map((transaction) => (
            <Card key={transaction.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>{transaction.customerName}</span>
                      <Badge variant="outline">{transaction.gameType}</Badge>
                    </CardTitle>
                    <CardDescription>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {transaction.date}
                        </span>
                        <span>Agent: {transaction.agentName}</span>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(transaction)}>
                      Edit
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => deleteTransaction(transaction.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span>Rolling: ${transaction.rollingAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {transaction.winLoss >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <span className={transaction.winLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
                      W/L: ${transaction.winLoss.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {transaction.winLoss >= 0 ? 'Customer Win' : 'House Win'}
                    </span>
                  </div>
                </div>
                {transaction.notes && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-700">{transaction.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}