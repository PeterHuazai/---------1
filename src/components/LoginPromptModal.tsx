import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus, X } from 'lucide-react';

interface LoginPromptModalProps {
  open: boolean;
  onClose: () => void;
  action?: string;
}

const LoginPromptModal: React.FC<LoginPromptModalProps> = ({ open, onClose, action }) => {
  const navigate = useNavigate();

  const handleLogin = () => {
    onClose();
    navigate('/login');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-sm p-0 overflow-hidden rounded-2xl">
        {/* 顶部彩色条 */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#165DFF] via-[#3491FA] to-[#36CBCB]" />
        <div className="p-6">
          <DialogHeader className="items-center text-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-[#165DFF]/10 flex items-center justify-center mx-auto mb-3">
              <LogIn className="w-7 h-7 text-[#165DFF]" />
            </div>
            <DialogTitle className="text-lg font-bold text-gray-900">登录后继续</DialogTitle>
            <DialogDescription className="text-gray-500 mt-1.5 text-sm text-balance leading-relaxed">
              {action ? `「${action}」需要登录账号才能使用。` : '该功能需要登录后使用。'}
              <br />登录后即可享受全部服务。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2.5">
            <Button
              onClick={handleLogin}
              className="w-full h-11 bg-[#165DFF] hover:bg-[#165DFF]/90 text-white font-semibold rounded-xl gap-2 shadow-sm"
            >
              <LogIn className="w-4 h-4" /> 登录账号
            </Button>
            <Button
              variant="outline"
              onClick={handleLogin}
              className="w-full h-11 rounded-xl gap-2 border-[#E5E6EB]"
            >
              <UserPlus className="w-4 h-4 text-[#165DFF]" /> 免费注册
            </Button>
            <button
              onClick={onClose}
              className="w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 transition-colors"
            >
              暂不登录，继续浏览
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginPromptModal;
