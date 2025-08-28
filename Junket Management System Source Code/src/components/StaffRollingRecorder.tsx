import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Camera, 
  Upload, 
  Scan, 
  DollarSign, 
  Calendar, 
  Clock, 
  MapPin, 
  Hash, 
  Eye, 
  EyeOff, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Save,
  User as UserIcon,
  Receipt,
  Database,
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
  ShieldCheck,
  Activity,
  Lock,
  Building2
} from 'lucide-react';
import { User, Customer, GameType, RollingRecord, BuyInOutRecord, OCRData, FileAttachment, Staff } from '../types';
import { withErrorHandler, WithErrorHandlerProps } from './withErrorHandler';
import { db } from '../utils/supabase/supabaseClients';

interface StaffRollingRecorderProps extends WithErrorHandlerProps {
  user: User;
  currentStaff: Staff;
  customers?: Customer[];
  gameTypes?: GameType[];
  onRecordSaved?: (record: RollingRecord) => void;
}

// Real-time refresh interval (10 seconds for customer data)
const CUSTOMER_REFRESH_INTERVAL = 10000;

// Casino venue options with Okada Manila Casino as default
const CASINO_VENUES = [
  'Okada Manila Casino',
  'City of Dreams Manila',
  'Resorts World Manila',
  'Solaire Resort & Casino',
  'Newport World Resorts',
  'Pagcor Casino Filipino',
  'Winford Hotel & Casino',
  'Other Casino'
];

function StaffRollingRecorderComponent({ 
  user, 
  currentStaff,
  customers: initialCustomers = [],
  gameTypes: initialGameTypes = [],
  onRecordSaved,
  showError,
  clearError
}: StaffRollingRecorderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [ocrResults, setOcrResults] = useState<OCRData | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(true);
  const [uploadedImage, setUploadedImage] = useState<FileAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Real-time customer data
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [gameTypes, setGameTypes] = useState<GameType[]>(initialGameTypes);
  const [lastCustomerUpdate, setLastCustomerUpdate] = useState<Date | null>(null);

  const [formData, setFormData] = useState({
    customerId: '',
    rollingAmount: '',
    winLoss: '',
    buyInAmount: '',
    buyOutAmount: '',
    gameType: '',
    venue: 'Okada Manila Casino', // Default to Okada Manila Casino
    tableNumber: '',
    sessionStartTime: '',
    sessionEndTime: '',
    notes: ''
  });

  // Load real-time customer data from Supabase
  const loadRealTimeCustomerData = useCallback(async () => {
    try {
      setIsLoadingCustomers(true);
      clearError();
      
      const [customersData, gameTypesData] = await Promise.all([
        db.get('customers', []),
        db.get('game_types', [])
      ]);

      setCustomers(customersData);
      setGameTypes(gameTypesData);
      setLastCustomerUpdate(new Date());
      
      console.log(`✅ Loaded ${customersData.length} customers for real-time rolling recording`);
    } catch (error) {
      console.error('❌ Error loading real-time customer data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to load customer data: ${errorMessage}`);
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [clearError, showError]);

  // Real-time customer data sync
  useEffect(() => {
    if (isDialogOpen) {
      // Load data when dialog opens
      loadRealTimeCustomerData();
      
      // Set up real-time refresh interval
      const refreshInterval = setInterval(() => {
        console.log('🔄 Refreshing customer data for rolling recorder');
        loadRealTimeCustomerData();
      }, CUSTOMER_REFRESH_INTERVAL);

      return () => {
        clearInterval(refreshInterval);
      };
    }
  }, [isDialogOpen, loadRealTimeCustomerData]);

  // Enhanced OCR processing with buy-in/buy-out extraction and venue detection
  const processImageWithOCR = async (imageData: string): Promise<OCRData> => {
    setIsProcessingOCR(true);
    
    // Simulate OCR processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock OCR results - in a real implementation, this would call an actual OCR service
    const mockOCRResult: OCRData = {
      id: `ocr_${Date.now()}`,
      originalImageId: uploadedImage?.id || '',
      extractedText: "GAMING RECEIPT\\nOKADA MANILA CASINO\\nDate: 2024-01-15\\nTime: 14:30\\nCustomer: John Doe\\nTable: B-5\\nGame: Baccarat\\nRolling: $50,000\\nResult: -$1,500\\nBuy-in: $25,000\\nBuy-out: $22,000\\nVenue: Okada Manila Casino\\nStaff: Casino Floor",
      confidence: 0.94,
      extractedFields: {
        amount: "50000",
        winLoss: "-1500",
        buyIn: "25000",
        buyOut: "22000",
        date: "2024-01-15",
        time: "14:30",
        venue: "Okada Manila Casino",
        gameType: "Baccarat",
        tableNumber: "B-5",
        customerName: "John Doe"
      },
      processedAt: new Date().toISOString(),
      ocrEngine: 'enhanced-staff-ocr-engine'
    };

    setIsProcessingOCR(false);
    return mockOCRResult;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string;
      
      const attachment: FileAttachment = {
        id: `img_${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        data: base64Data,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.id
      };

      setUploadedImage(attachment);
      
      // Process with enhanced OCR
      try {
        const ocrResult = await processImageWithOCR(base64Data);
        setOcrResults(ocrResult);
        
        // Auto-fill form with OCR results including buy-in/buy-out and venue
        if (ocrResult.extractedFields) {
          setFormData(prev => ({
            ...prev,
            rollingAmount: ocrResult.extractedFields.amount || prev.rollingAmount,
            winLoss: ocrResult.extractedFields.winLoss || prev.winLoss,
            buyInAmount: ocrResult.extractedFields.buyIn || prev.buyInAmount,
            buyOutAmount: ocrResult.extractedFields.buyOut || prev.buyOutAmount,
            gameType: ocrResult.extractedFields.gameType || prev.gameType,
            // Match OCR venue to available options, default to Okada Manila Casino
            venue: CASINO_VENUES.find(v => 
              ocrResult.extractedFields.venue?.toLowerCase().includes(v.toLowerCase())
            ) || prev.venue,
            tableNumber: ocrResult.extractedFields.tableNumber || prev.tableNumber,
            sessionStartTime: ocrResult.extractedFields.date && ocrResult.extractedFields.time 
              ? `${ocrResult.extractedFields.date}T${ocrResult.extractedFields.time}` 
              : prev.sessionStartTime
          }));

          // Try to match customer name if provided
          if (ocrResult.extractedFields.customerName) {
            const matchedCustomer = customers.find(c => 
              c.name.toLowerCase().includes(ocrResult.extractedFields.customerName!.toLowerCase()) ||
              ocrResult.extractedFields.customerName!.toLowerCase().includes(c.name.toLowerCase())
            );
            if (matchedCustomer) {
              setFormData(prev => ({ ...prev, customerId: matchedCustomer.id }));
            }
          }
        }
        
        setShowManualEntry(false);
      } catch (error) {
        console.error('OCR processing failed:', error);
        showError('OCR processing failed. Please enter the data manually.');
      }
    };
    
    reader.readAsDataURL(file);
  };

  const handleSaveRecord = async () => {
    const selectedCustomer = customers.find(c => c.id === formData.customerId);
    if (!selectedCustomer) {
      showError('Please select a customer');
      return;
    }

    // Validate required buy-in/buy-out for admin authority
    if (user.role === 'admin' || user.role === 'staff') {
      if (!formData.buyInAmount && !formData.buyOutAmount) {
        showError('Buy-in or buy-out amount is required for admin oversight');
        return;
      }
    }

    try {
      setIsSaving(true);
      clearError();

      const now = new Date().toISOString();
      const rollingAmount = parseFloat(formData.rollingAmount) || 0;
      const winLoss = parseFloat(formData.winLoss) || 0;
      const buyInAmount = parseFloat(formData.buyInAmount) || 0;
      const buyOutAmount = parseFloat(formData.buyOutAmount) || 0;

      // Create rolling record
      const newRecord: RollingRecord = {
        id: `rolling_${Date.now()}`,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        agentId: selectedCustomer.agentId,
        agentName: selectedCustomer.agentName,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        rollingAmount,
        winLoss,
        buyInAmount,
        buyOutAmount,
        gameType: formData.gameType,
        venue: formData.venue, // Now from dropdown selection
        tableNumber: formData.tableNumber,
        sessionStartTime: formData.sessionStartTime,
        sessionEndTime: formData.sessionEndTime,
        recordedAt: now,
        notes: formData.notes,
        attachments: uploadedImage ? [uploadedImage] : [],
        ocrData: ocrResults || undefined,
        verified: false,
        shiftId: currentStaff.currentShift?.id
      };

      // Create buy-in/buy-out records if amounts are provided
      const buyInOutRecords: BuyInOutRecord[] = [];
      
      if (buyInAmount > 0) {
        buyInOutRecords.push({
          id: `buyin_${Date.now()}`,
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          staffId: currentStaff.id,
          staffName: currentStaff.name,
          transactionType: 'buy-in',
          amount: buyInAmount,
          timestamp: now,
          venue: formData.venue,
          tableNumber: formData.tableNumber,
          notes: formData.notes,
          proofPhoto: uploadedImage || undefined,
          shiftId: currentStaff.currentShift?.id,
          tripId: undefined // Could be linked to a trip later
        });
      }

      if (buyOutAmount > 0) {
        buyInOutRecords.push({
          id: `buyout_${Date.now()}_1`,
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          staffId: currentStaff.id,
          staffName: currentStaff.name,
          transactionType: 'buy-out',
          amount: buyOutAmount,
          timestamp: now,
          venue: formData.venue,
          tableNumber: formData.tableNumber,
          notes: formData.notes,
          proofPhoto: uploadedImage || undefined,
          shiftId: currentStaff.currentShift?.id,
          tripId: undefined // Could be linked to a trip later
        });
      }

      console.log('💾 Saving rolling record and buy-in/buy-out data to Supabase...');

      // Get existing data from Supabase
      const [existingRecords, existingCustomers, existingBuyInOutRecords] = await Promise.all([
        db.get('rolling_records', []),
        db.get('customers', []),
        db.get('buy_in_out_records', [])
      ]);

      // Update rolling records
      const updatedRecords = [...existingRecords, newRecord];
      
      // Update buy-in/buy-out records
      const updatedBuyInOutRecords = [...existingBuyInOutRecords, ...buyInOutRecords];

      // Update customer totals with new data
      const updatedCustomers = existingCustomers.map((c: Customer) => 
        c.id === selectedCustomer.id 
          ? {
              ...c,
              totalRolling: (c.totalRolling || 0) + rollingAmount,
              totalWinLoss: (c.totalWinLoss || 0) + winLoss,
              totalBuyIn: (c.totalBuyIn || 0) + buyInAmount,
              totalBuyOut: (c.totalBuyOut || 0) + buyOutAmount
            }
          : c
      );

      // Save all updates to Supabase simultaneously
      await Promise.all([
        db.save('rollingRecords', updatedRecords),
        db.save('customers', updatedCustomers),
        buyInOutRecords.length > 0 ? db.save('buyInOutRecords', updatedBuyInOutRecords) : Promise.resolve()
      ]);

      console.log('✅ Successfully saved rolling record and buy-in/buy-out data to Supabase');

      // Refresh customer data immediately after saving
      await loadRealTimeCustomerData();

      // Call the callback if provided
      onRecordSaved?.(newRecord);
      
      // Reset form
      setFormData({
        customerId: '',
        rollingAmount: '',
        winLoss: '',
        buyInAmount: '',
        buyOutAmount: '',
        gameType: '',
        venue: 'Okada Manila Casino', // Reset to default
        tableNumber: '',
        sessionStartTime: '',
        sessionEndTime: '',
        notes: ''
      });
      setUploadedImage(null);
      setOcrResults(null);
      setShowManualEntry(true);
      setIsDialogOpen(false);
      
    } catch (error) {
      console.error('❌ Failed to save rolling record:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showError(`Failed to save rolling record: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = () => {
    const basicValid = formData.customerId && 
                      formData.rollingAmount && 
                      formData.gameType && 
                      formData.sessionStartTime;
    
    // For admin users, require buy-in or buy-out
    if (user.role === 'admin' || user.role === 'staff') {
      return basicValid && (formData.buyInAmount || formData.buyOutAmount);
    }
    
    return basicValid;
  };

  // Filter active customers
  const activeCustomers = customers.filter(c => c.isActive);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center space-x-2" disabled={isSaving}>
          <Receipt className="w-4 h-4" />
          <span>Record Rolling</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Receipt className="w-5 h-5" />
            <span>Record Customer Rolling Amount</span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Building2 className="w-3 h-3 mr-1" />
              Casino Selection Available
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Record rolling amounts with mandatory buy-in/buy-out tracking for admin oversight. 
            Select from available casino venues with real-time customer data and OCR receipt processing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Real-time Database Status */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Database className="w-4 h-4 text-green-600 mr-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">
                    ✅ Real-time Data Connected to Supabase
                  </p>
                  <p className="text-xs text-green-600">
                    Rolling records and buy-in/buy-out data immediately saved to cloud database
                    {lastCustomerUpdate && ` • Last customer sync: ${lastCustomerUpdate.toLocaleTimeString()}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {isSaving && (
                  <div className="flex items-center text-blue-600">
                    <Save className="w-4 h-4 mr-1 animate-pulse" />
                    <span className="text-xs">Saving...</span>
                  </div>
                )}
                {isLoadingCustomers && (
                  <div className="flex items-center text-orange-600">
                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                    <span className="text-xs">Syncing...</span>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadRealTimeCustomerData}
                  disabled={isSaving || isLoadingCustomers}
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Staff Info & Admin Authority Banner */}
          <Alert>
            <UserIcon className="w-4 h-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <span>Recording as: <strong>{currentStaff.name}</strong> ({currentStaff.position})</span>
                  {currentStaff.currentShift && (
                    <div className="text-xs text-gray-500 mt-1">
                      Shift: {currentStaff.currentShift.shiftDate} | 
                      Started: {new Date(currentStaff.currentShift.checkInTime).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {(user.role === 'admin' || user.role === 'staff') && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Admin Authority Required
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    <Building2 className="w-3 h-3 mr-1" />
                    Multiple Venues
                  </Badge>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Buy-in/Buy-out Requirement Notice */}
          {(user.role === 'admin' || user.role === 'staff') && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Admin Oversight Required:</strong> Buy-in or buy-out amount is mandatory for all rolling records. 
                This ensures complete financial tracking and regulatory compliance.
              </AlertDescription>
            </Alert>
          )}

          {/* Image Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Camera className="w-4 h-4" />
                <span>Receipt/Photo Upload</span>
                <Badge variant="secondary" className="text-xs">Enhanced OCR</Badge>
              </CardTitle>
              <CardDescription>
                Upload receipts for automatic extraction of rolling amounts, buy-in/buy-out, venue, and transaction details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center space-x-2"
                  disabled={isSaving}
                >
                  <Camera className="w-4 h-4" />
                  <span>Take Photo</span>
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-2"
                  disabled={isSaving}
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Image</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowManualEntry(!showManualEntry)}
                  className="flex items-center space-x-2"
                  disabled={isSaving}
                >
                  {showManualEntry ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showManualEntry ? 'Hide' : 'Show'} Manual Entry</span>
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isSaving}
              />
              
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
                disabled={isSaving}
              />

              {/* OCR Processing Status */}
              {isProcessingOCR && (
                <Alert>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <AlertDescription>
                    Processing receipt with enhanced OCR (including buy-in/buy-out and venue detection)... Please wait.
                  </AlertDescription>
                </Alert>
              )}

              {/* OCR Results */}
              {ocrResults && (
                <Alert>
                  <CheckCircle className="w-4 h-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p>Enhanced text extraction completed with {Math.round(ocrResults.confidence * 100)}% confidence</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {ocrResults.extractedFields.amount && (
                          <Badge variant="outline">Rolling: ${ocrResults.extractedFields.amount}</Badge>
                        )}
                        {ocrResults.extractedFields.buyIn && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            Buy-in: ${ocrResults.extractedFields.buyIn}
                          </Badge>
                        )}
                        {ocrResults.extractedFields.buyOut && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700">
                            Buy-out: ${ocrResults.extractedFields.buyOut}
                          </Badge>
                        )}
                        {ocrResults.extractedFields.venue && (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            Venue: {ocrResults.extractedFields.venue}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Uploaded Image Preview */}
              {uploadedImage && (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Uploaded Receipt</span>
                    <Badge variant="secondary">{uploadedImage.name}</Badge>
                  </div>
                  <img 
                    src={uploadedImage.data} 
                    alt="Uploaded receipt" 
                    className="max-h-48 w-auto rounded border"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Form Section */}
          {showManualEntry && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span>Rolling & Cash Flow Details</span>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    <Lock className="w-3 h-3 mr-1" />
                    Buy-in/Buy-out Required
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {ocrResults ? 'Review and edit the extracted information' : 'Enter complete transaction details including venue selection and buy-in/buy-out amounts'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Customer Selection with Real-time Data */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="customer" className="flex items-center space-x-2">
                      <span>Customer *</span>
                      {isLoadingCustomers && (
                        <Activity className="w-3 h-3 animate-pulse text-blue-500" />
                      )}
                    </Label>
                    <Badge variant="outline" className="text-xs">
                      {activeCustomers.length} active customers
                    </Badge>
                  </div>
                  <Select 
                    value={formData.customerId} 
                    onValueChange={(value) => setFormData({...formData, customerId: value})} 
                    disabled={isSaving || isLoadingCustomers}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer (real-time data)" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCustomers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{customer.name} ({customer.agentName})</span>
                            <div className="flex items-center space-x-2 text-xs text-gray-500 ml-4">
                              <span>Rolling: ${(customer.totalRolling || 0).toLocaleString()}</span>
                              <span>Rate: {customer.rollingPercentage}%</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Financial Data Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="rollingAmount" className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4" />
                      <span>Rolling Amount (HKD) *</span>
                    </Label>
                    <Input
                      id="rollingAmount"
                      type="number"
                      value={formData.rollingAmount}
                      onChange={(e) => setFormData({...formData, rollingAmount: e.target.value})}
                      placeholder="50000"
                      required
                      disabled={isSaving}
                    />
                  </div>

                  <div>
                    <Label htmlFor="winLoss">Win/Loss Amount (HKD)</Label>
                    <Input
                      id="winLoss"
                      type="number"
                      value={formData.winLoss}
                      onChange={(e) => setFormData({...formData, winLoss: e.target.value})}
                      placeholder="-1500 (negative for loss)"
                      disabled={isSaving}
                    />
                  </div>

                  <div>
                    <Label htmlFor="gameType">Game Type *</Label>
                    <Select value={formData.gameType} onValueChange={(value) => setFormData({...formData, gameType: value})} disabled={isSaving}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select game type" />
                      </SelectTrigger>
                      <SelectContent>
                        {gameTypes.length > 0 ? (
                          gameTypes.filter(g => g.isActive).map((game) => (
                            <SelectItem key={game.id} value={game.name}>
                              {game.name}
                            </SelectItem>
                          ))
                        ) : (
                          // Default game types for Philippine casinos
                          <>
                            <SelectItem value="Baccarat">Baccarat</SelectItem>
                            <SelectItem value="Blackjack">Blackjack</SelectItem>
                            <SelectItem value="Roulette">Roulette</SelectItem>
                            <SelectItem value="Poker">Poker</SelectItem>
                            <SelectItem value="Dragon Tiger">Dragon Tiger</SelectItem>
                            <SelectItem value="Sic Bo">Sic Bo</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Buy-in/Buy-out Section - MANDATORY */}
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <h4 className="font-medium text-red-800">Cash Flow Tracking (Required)</h4>
                    <Badge variant="outline" className="bg-red-100 text-red-700">
                      Admin Oversight
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="buyInAmount" className="flex items-center space-x-2">
                        <ArrowDownCircle className="w-4 h-4 text-blue-500" />
                        <span>Buy-in Amount (HKD) {(user.role === 'admin' || user.role === 'staff') ? '*' : ''}</span>
                      </Label>
                      <Input
                        id="buyInAmount"
                        type="number"
                        value={formData.buyInAmount}
                        onChange={(e) => setFormData({...formData, buyInAmount: e.target.value})}
                        placeholder="25000"
                        required={user.role === 'admin' || user.role === 'staff'}
                        disabled={isSaving}
                      />
                      <p className="text-xs text-blue-600 mt-1">
                        Customer deposit/chips purchased
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="buyOutAmount" className="flex items-center space-x-2">
                        <ArrowUpCircle className="w-4 h-4 text-purple-500" />
                        <span>Buy-Out Amount (HKD) {(user.role === 'admin' || user.role === 'staff') ? '*' : ''}</span>
                      </Label>
                      <Input
                        id="buyOutAmount"
                        type="number"
                        value={formData.buyOutAmount}
                        onChange={(e) => setFormData({...formData, buyOutAmount: e.target.value})}
                        placeholder="22000"
                        required={user.role === 'admin' || user.role === 'staff'}
                        disabled={isSaving}
                      />
                      <p className="text-xs text-purple-600 mt-1">
                        Customer withdrawal/chips cashed out
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-700">
                    <strong>Note:</strong> At least one cash flow amount (buy-in or buy-out) must be provided for complete financial tracking and admin oversight.
                  </div>
                </div>

                {/* Venue and Table Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="venue" className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4" />
                      <span>Casino Venue *</span>
                    </Label>
                    <Select 
                      value={formData.venue} 
                      onValueChange={(value) => setFormData({...formData, venue: value})}
                      disabled={isSaving}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select casino venue" />
                      </SelectTrigger>
                      <SelectContent>
                        {CASINO_VENUES.map((venue) => (
                          <SelectItem key={venue} value={venue}>
                            <div className="flex items-center space-x-2">
                              <Building2 className="w-4 h-4" />
                              <span>{venue}</span>
                              {venue === 'Okada Manila Casino' && (
                                <Badge variant="secondary" className="text-xs ml-2">Default</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Select from available casino venues
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="tableNumber" className="flex items-center space-x-2">
                      <Hash className="w-4 h-4" />
                      <span>Table Number</span>
                    </Label>
                    <Input
                      id="tableNumber"
                      value={formData.tableNumber}
                      onChange={(e) => setFormData({...formData, tableNumber: e.target.value})}
                      placeholder="B-5"
                      disabled={isSaving}
                    />
                  </div>

                  <div className="flex items-end">
                    <div className="w-full">
                      <Label className="text-xs text-gray-500">Net Cash Flow</Label>
                      <div className="mt-1 p-2 bg-gray-50 border rounded">
                        <span className={`font-medium ${
                          (parseFloat(formData.buyOutAmount) || 0) - (parseFloat(formData.buyInAmount) || 0) >= 0 
                            ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${((parseFloat(formData.buyOutAmount) || 0) - (parseFloat(formData.buyInAmount) || 0)).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Buy-out - Buy-in
                      </p>
                    </div>
                  </div>
                </div>

                {/* Session Timing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sessionStartTime" className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>Session Start *</span>
                    </Label>
                    <Input
                      id="sessionStartTime"
                      type="datetime-local"
                      value={formData.sessionStartTime}
                      onChange={(e) => setFormData({...formData, sessionStartTime: e.target.value})}
                      required
                      disabled={isSaving}
                    />
                  </div>

                  <div>
                    <Label htmlFor="sessionEndTime" className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>Session End</span>
                    </Label>
                    <Input
                      id="sessionEndTime"
                      type="datetime-local"
                      value={formData.sessionEndTime}
                      onChange={(e) => setFormData({...formData, sessionEndTime: e.target.value})}
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Additional notes about this gaming session, venue details, buy-in/buy-out information..."
                    rows={3}
                    disabled={isSaving}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveRecord}
              disabled={!isFormValid() || isProcessingOCR || isSaving}
              className="flex items-center space-x-2"
            >
              {isSaving ? (
                <>
                  <Save className="w-4 h-4 animate-spin" />
                  <span>Saving to Supabase...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Complete Record</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Export with error handler wrapper
export const StaffRollingRecorder = withErrorHandler(StaffRollingRecorderComponent);